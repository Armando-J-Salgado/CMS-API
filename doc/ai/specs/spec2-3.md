# Spec 2-3: Autorización JWT en Crear y Actualizar Posts

Este documento define cómo se integra la autenticación JWT en los flujos de creación (`POST /posts`) y actualización (`PATCH /posts/:id`, `PUT /posts/:id`). Depende de Spec 0 (Foundation), Spec 2-1 (Users & Authentication), Spec 3 (Store) y Spec 4 (Update).

---

## 1. Contexto

Actualmente los endpoints de creación y actualización de posts no requieren autenticación. El campo `author_id` se envía manualmente en el body de la petición, lo cual permite que cualquier cliente se atribuya la autoría de cualquier post y que modifique posts ajenos sin restricción.

Esta spec cierra esas brechas:
- **Crear un post lo convierte en propiedad del usuario autenticado.**
- **Solo el autor de un post puede modificarlo.**
- **Ambos endpoints requieren un JWT válido.**

---

## 2. Reglas de Negocio

### 2.1 Creación de Posts (`POST /posts`)

| Regla | Descripción |
|---|---|
| JWT obligatorio | Se aplica `JwtAuthGuard`. Sin token válido → `401 Unauthorized`. |
| `author_id` inferido | El campo `author_id` se toma de `req.user.id` (extraído del JWT). Se **elimina** `author_id` del `CreatePostDto` — el cliente no puede enviarlo. |
| Autoría automática | El post creado siempre pertenece al usuario autenticado. |

### 2.2 Actualización de Posts (`PATCH /posts/:id`, `PUT /posts/:id`)

| Regla | Descripción |
|---|---|
| JWT obligatorio | Se aplica `JwtAuthGuard`. Sin token válido → `401 Unauthorized`. |
| Solo el autor modifica | Si `req.user.id !== post.author_id` → `403 Forbidden`. |
| Transferencia de autoría | El campo `author_id` se mantiene en los DTOs de update. Solo el autor actual puede transferir la autoría a otro usuario enviando un `author_id` diferente. |
| Posts sin autor | Si un post tiene `author_id = null` (posts legacy creados antes de esta spec), cualquier usuario autenticado puede reclamarlo al actualizarlo — la primera actualización le asigna autoría. Una vez asignado, se aplican las reglas normales de propiedad. |

### 2.3 Tabla de decisión — Acceso al Update

| `post.author_id` | `req.user.id` | Resultado |
|---|---|---|
| `null` | cualquier usuario | `200 OK` — se permite la actualización (el post no tiene dueño) |
| `1` | `1` | `200 OK` — es el autor |
| `1` | `2` | `403 Forbidden` — no es el autor |
| cualquiera | sin token | `401 Unauthorized` |

---

## 3. Cambios en DTOs

### 3.1 `CreatePostDto` — Eliminar `author_id`

Se elimina el campo `author_id` del DTO. El `author_id` se inyecta desde el token JWT en el controller antes de llamar al service.

**Antes:**
```typescript
@ApiPropertyOptional({ example: 1, nullable: true })
@IsOptional()
@IsInt()
author_id?: number | null;
```

**Después:** campo eliminado del DTO.

### 3.2 `UpdatePostDto` y `ReplacePostDto` — `author_id` se mantiene

El campo `author_id` permanece en ambos DTOs para permitir la transferencia de autoría. Solo el autor actual puede enviar este campo.

---

## 4. Cambios en Controller

### 4.1 `POST /posts` — Agregar guard y extraer `author_id`

```typescript
@Post()
@UseGuards(JwtAuthGuard)
@HttpCode(HttpStatus.CREATED)
async create(@Body() dto: CreatePostDto, @Req() req: any): Promise<PostEntity> {
  return this.postsService.create(dto, req.user.id);
}
```

El `PostsService.create()` recibe el `userId` como segundo argumento y lo usa como `author_id`.

### 4.2 `PATCH /posts/:id` — Agregar guard y pasar `userId`

```typescript
@Patch(':id')
@UseGuards(JwtAuthGuard)
async update(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: UpdatePostDto,
  @Req() req: any,
): Promise<PostEntity> {
  return await this.postsService.update(id, dto, req.user.id);
}
```

### 4.3 `PUT /posts/:id` — Agregar guard y pasar `userId`

```typescript
@Put(':id')
@UseGuards(JwtAuthGuard)
async replace(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: ReplacePostDto,
  @Req() req: any,
): Promise<PostEntity> {
  return await this.postsService.update(id, dto, req.user.id);
}
```

---

## 5. Cambios en Service

### 5.1 `create()` — recibir `userId`

La firma cambia de `create(dto: CreatePostDto)` a `create(dto: CreatePostDto, userId: number)`.

El `author_id` se asigna internamente:
```typescript
author_id: userId,
```

### 5.2 `update()` — `currentUserId` pasa de opcional a obligatorio

La firma cambia de `update(id, dto, currentUserId?: number)` a `update(id, dto, currentUserId: number)`.

La lógica de validación de propiedad existente (líneas 76-82 del service actual) se mantiene, pero ahora `currentUserId` siempre se recibe:

```typescript
if (post.author_id !== null && post.author_id !== currentUserId) {
  throw new ForbiddenException("No tienes permiso para modificar este post.");
}
```

---

## 6. Formato de Error

Reutiliza el envelope estándar de Spec 0:

### 401 Unauthorized — Token faltante o inválido
```json
{
  "error": "Unauthorized",
  "message": "Unauthorized",
  "details": {}
}
```

### 403 Forbidden — No es el autor
```json
{
  "error": "Forbidden",
  "message": "No tienes permiso para modificar este post.",
  "details": {}
}
```

---

## 7. Impacto en Tests Existentes

### 7.1 Tests de creación (`posts.e2e-spec.ts`)

Los tests existentes de `POST /api/posts` que no envían un JWT dejarán de funcionar ya que ahora el endpoint requiere autenticación. Deben actualizarse para:
- Registrar/crear un usuario de prueba.
- Generar un token JWT.
- Enviar el header `Authorization: Bearer <token>` en cada petición.
- Verificar que el `author_id` del post creado coincide con el `id` del usuario autenticado.

### 7.2 Tests de actualización (`posts-update.e2e-spec.ts`)

Los tests existentes de `PATCH/PUT /api/posts/:id` que no envían JWT dejarán de funcionar. Deben actualizarse para:
- Crear posts con `author_id` vinculado al usuario de prueba.
- Enviar el header `Authorization: Bearer <token>`.

---

## 8. Escenarios de Pruebas (E2E)

### 8.1 Creación

| Escenario | Resultado Esperado |
|---|---|
| `POST /posts` con JWT válido y body válido | `201 Created`, `author_id` = `req.user.id` |
| `POST /posts` sin token | `401 Unauthorized` |
| `POST /posts` con token inválido/expirado | `401 Unauthorized` |
| `POST /posts` con JWT válido, verificar que `author_id` del body se ignora | `201 Created`, `author_id` = `req.user.id` (no el enviado en body) |

### 8.2 Actualización — Propiedad

| Escenario | Verbo | Resultado Esperado |
|---|---|---|
| Actualizar post propio | `PATCH` | `200 OK` |
| Actualizar post ajeno | `PATCH` | `403 Forbidden` |
| Actualizar post propio | `PUT` | `200 OK` |
| Actualizar post ajeno | `PUT` | `403 Forbidden` |
| Actualizar post sin token | `PATCH` | `401 Unauthorized` |
| Actualizar post sin token | `PUT` | `401 Unauthorized` |
| Actualizar post con `author_id = null` (sin dueño) | `PATCH` | `200 OK` — se permite |
| Transferir autoría como autor actual | `PATCH` | `200 OK`, `author_id` cambia |
| Transferir autoría como no-autor | `PATCH` | `403 Forbidden` |

---

## 9. Fuera de Alcance

- Roles y permisos (admin, editor, etc.).
- Eliminación de posts (será otra spec).
- Listado de posts con filtros de autoría.
- Validación de que el `author_id` destino en una transferencia existe como usuario real.

---

## 10. Criterios de Aceptación

- `POST /posts` requiere JWT y asigna `author_id` desde el token.
- `PATCH /posts/:id` y `PUT /posts/:id` requieren JWT.
- Solo el autor puede modificar su post → `403` si no es el autor.
- Posts sin `author_id` (legacy) pueden ser actualizados por cualquier usuario autenticado.
- El campo `author_id` ya no se acepta en el body de creación.
- Todos los tests existentes actualizados para usar JWT.
- Nuevos tests cubren: sin token (401), post ajeno (403), post propio (200), transferencia de autoría.
