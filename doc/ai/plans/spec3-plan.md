# Plan de Implementación: Spec 4 — Store POST /posts

Referencia: [`spec4.md`](../specs/spec4.md) · Fundación: [`spec0.md`](../specs/spec0.md)

---

## Contexto

Se necesita implementar el endpoint `POST /api/posts` que permita crear un post nuevo.
El endpoint debe validar campos obligatorios, generar el slug automáticamente si no se provee, y
devolver errores en el formato estándar definido en Spec 0.

---

## Archivos a Crear o Modificar

| Archivo | Acción |
|---|---|
| `src/posts/dto/create-post.dto.ts` | **CREAR** — DTO con validaciones |
| `src/posts/posts.service.ts` | **MODIFICAR** — agregar método `create()` |
| `src/posts/posts.controller.ts` | **MODIFICAR** — agregar handler `POST /posts` |
| `test/posts.e2e-spec.ts` | **CREAR** — tests E2E de la spec 4 |

> No se crea ni modifica ningún otro módulo, entidad ni configuración de la Spec 0 porque
> la entidad `Post`, el filtro de excepciones, los errores base y el módulo ya están listos.

---

## 1. DTO — `src/posts/dto/create-post.dto.ts`

Define la forma del body que recibe el endpoint.

### Campos

| Campo | Tipo TS | Obligatorio | Reglas de validación | Valor por defecto |
|---|---|---|---|---|
| `title` | `string` | Sí | `@IsNotEmpty()`, `@IsString()` | — |
| `content` | `string` | Sí | `@IsNotEmpty()`, `@IsString()` | — |
| `slug` | `string` | No | `@IsOptional()`, `@IsString()` | se genera en servicio |
| `status` | `PostStatus` | No | `@IsOptional()`, `@IsIn([...])` | `"draft"` |
| `excerpt` | `string \| null` | No | `@IsOptional()`, `@IsString()` | `null` |
| `author_id` | `number \| null` | No | `@IsOptional()`, `@IsInt()` | `null` |

### Tipo enum auxiliar (dentro del mismo DTO)

```typescript
export type PostStatus = "draft" | "publish" | "pending" | "private" | "trash";
export const POST_STATUS_VALUES: PostStatus[] = [
  "draft", "publish", "pending", "private", "trash"
];
```

### Decoradores Swagger requeridos

Cada campo lleva `@ApiProperty()` o `@ApiPropertyOptional()` para que aparezca en `/api/docs`.

### Ejemplo de body válido

```json
{
  "title": "Mi primer post",
  "content": "Contenido del post"
}
```

### Ejemplo de body completo

```json
{
  "title": "Mi primer post",
  "content": "Contenido del post",
  "slug": "mi-primer-post",
  "status": "draft",
  "excerpt": "Resumen breve",
  "author_id": 1
}
```

---

## 2. Lógica de Negocio — `PostsService.create()`

### Firma del método

```typescript
async create(dto: CreatePostDto): Promise<Post>
```

### Pasos internos (en orden)

1. **Generar slug** si `dto.slug` no viene o es vacío:
   - Transformar `dto.title` a minúsculas.
   - Reemplazar espacios y caracteres no alfanuméricos por `-`.
   - Ejemplo: `"Mi Primer Post!"` → `"mi-primer-post"`.
   - Función utilitaria privada recomendada: `private slugify(text: string): string`.

2. **Asignar status por defecto** si `dto.status` no viene:
   - Usar `"draft"`.

3. **Manejar `published_at`**:
   - Si el status que llega es `"publish"`, asignar `published_at = new Date()`.
   - En cualquier otro caso, `published_at = null`.

4. **Persistir** con `this.postRepository.save({ ...dto, slug, status, published_at })`.

5. **Retornar** el objeto `Post` guardado (con `id`, `created_at`, `updated_at` incluidos).

### Conflicto de slug duplicado

Si TypeORM lanza un error de `UNIQUE constraint failed: posts.slug`, el servicio lo debe
capturar y relanzar como `BadRequestError` (ya existe en `src/common/errors/app-errors.ts`)
con un mensaje descriptivo.

---

## 3. Controlador — `PostsController`

### Decoradores del método

```typescript
@Post()
@HttpCode(HttpStatus.CREATED)          // respuesta 201
@ApiOperation({ summary: "Create a post" })
@ApiBody({ type: CreatePostDto })
@ApiResponse({ status: 201, description: "Post created", type: Post })
@ApiResponse({ status: 422, description: "Validation error" })
async create(@Body() dto: CreatePostDto): Promise<Post>
```

### Parámetro de entrada

- `@Body()` recibe el DTO ya validado.
- La validación la realiza el **ValidationPipe global** de NestJS (ver nota abajo).

### Activación del ValidationPipe global

En `src/main.ts` se debe agregar **antes** de `app.listen()`:

```typescript
import { ValidationPipe, UnprocessableEntityException } from "@nestjs/common";

app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,          // elimina campos no declarados en el DTO
    forbidNonWhitelisted: false,
    exceptionFactory: (errors) => {
      const details: Record<string, string> = {};
      errors.forEach((e) => {
        details[e.property] = Object.values(e.constraints ?? {}).join(", ");
      });
      return new UnprocessableEntityException({
        error: "Unprocessable Entity",
        message: "Validation failed",
        details,
      });
    },
  }),
);
```

> **Por qué 422 y no 400:** La spec indica que campos faltantes devuelven 422.
> `UnprocessableEntityException` produce exactamente ese código.
> El `HttpExceptionFilter` ya existente lo formatea al esquema estándar de Spec 0.

---

## 4. Formato de respuestas

### Éxito (201 Created)

```json
{
  "id": 1,
  "title": "Mi primer post",
  "content": "Contenido del post",
  "slug": "mi-primer-post",
  "status": "draft",
  "excerpt": null,
  "author_id": null,
  "published_at": null,
  "deleted_at": null,
  "created_at": "2026-07-03T17:00:00.000Z",
  "updated_at": "2026-07-03T17:00:00.000Z"
}
```

### Error de validación — title faltante (422)

```json
{
  "error": "Unprocessable Entity",
  "message": "Validation failed",
  "details": {
    "title": "title should not be empty"
  }
}
```

### Error de validación — content faltante (422)

```json
{
  "error": "Unprocessable Entity",
  "message": "Validation failed",
  "details": {
    "content": "content should not be empty"
  }
}
```

---

## 5. Tests E2E — `test/posts.e2e-spec.ts`

Se usa el mismo patrón que `test/health.e2e-spec.ts`: `@nestjs/testing` + `supertest`.

### Setup

```
beforeAll  → crear TestingModule con AppModule, iniciar app con global prefix y ValidationPipe
afterAll   → cerrar app
```

> **Importante:** el `ValidationPipe` con `exceptionFactory` personalizado debe aplicarse
> también en el setup del test (igual que en `main.ts`) para que los tests sean fieles al
> comportamiento real.

### Casos de test

| # | `it(...)` | Método | Ruta | Body enviado | Status esperado | Verificaciones del body |
|---|---|---|---|---|---|---|
| 1 | `POST /api/posts — crea post exitosamente (201)` | POST | `/api/posts` | `{ title, content }` | `201` | `id` existe, `title`, `content`, `slug === "titulo-del-post"`, `status === "draft"` |
| 2 | `POST /api/posts — genera slug automático desde title` | POST | `/api/posts` | `{ title: "Hola Mundo", content: "x" }` | `201` | `slug === "hola-mundo"` |
| 3 | `POST /api/posts — falta title devuelve 422` | POST | `/api/posts` | `{ content: "x" }` | `422` | `details.title` existe y no está vacío |
| 4 | `POST /api/posts — falta content devuelve 422` | POST | `/api/posts` | `{ title: "x" }` | `422` | `details.content` existe y no está vacío |
| 5 | `POST /api/posts — status por defecto es draft` | POST | `/api/posts` | `{ title, content }` (sin status) | `201` | `status === "draft"` |

---

## 6. Orden de implementación recomendado

1. Modificar `src/main.ts` → agregar `ValidationPipe` global con `exceptionFactory`.
2. Crear `src/posts/dto/create-post.dto.ts` con todas las validaciones.
3. Modificar `src/posts/posts.service.ts` → implementar `create()` con `slugify`.
4. Modificar `src/posts/posts.controller.ts` → agregar handler `POST /posts`.
5. Crear `test/posts.e2e-spec.ts` con los 5 casos de test.
6. Ejecutar `npm run test:e2e` y verificar que todos los tests pasan en verde.

---

## 7. Comando de verificación

```bash
npm run test:e2e
```

Todos los tests del archivo `posts.e2e-spec.ts` deben reportar PASS.
