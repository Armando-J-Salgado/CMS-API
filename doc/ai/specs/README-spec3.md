# Walkthrough: Especificación 3 — Store POST /posts

Este documento detalla la implementación y el funcionamiento del endpoint de creación de publicaciones (`POST /posts`) del CMS API utilizando NestJS, de acuerdo con la [Especificación 3](file:///c:/Users/josh-/OneDrive/Documentos/CICLO8/PATRONES/TALLER/CMS-API/doc/ai/specs/spec3.md) y el [Plan de Implementación de Spec 3](file:///c:/Users/josh-/OneDrive/Documentos/CICLO8/PATRONES/TALLER/CMS-API/doc/ai/plans/spec3-plan.md).

## Estructura de Archivos Creados y Modificados

- [create-post.dto.ts](file:///c:/Users/josh-/OneDrive/Documentos/CICLO8/PATRONES/TALLER/CMS-API/src/posts/dto/create-post.dto.ts) (Nuevo): DTO de validación para la creación de un post. Define los campos obligatorios (`title`, `content`) y los opcionales (`slug`, `status`, `excerpt`, `author_id`).
- [posts.service.ts](file:///c:/Users/josh-/OneDrive/Documentos/CICLO8/PATRONES/TALLER/CMS-API/src/posts/posts.service.ts) (Modificado): Implementación del método `create()` con lógica de auto-generación de slug, asignación de status por defecto y manejo de `published_at`.
- [posts.controller.ts](file:///c:/Users/josh-/OneDrive/Documentos/CICLO8/PATRONES/TALLER/CMS-API/src/posts/posts.controller.ts) (Modificado): Definición del endpoint `POST /posts` con sus decoradores de Swagger y protección mediante `JwtAuthGuard`.
- [main.ts](file:///c:/Users/josh-/OneDrive/Documentos/CICLO8/PATRONES/TALLER/CMS-API/src/main.ts) (Modificado): Registro global del `ValidationPipe` con `exceptionFactory` personalizado para producir errores 422 en el formato estándar de Spec 0.
- [posts.e2e-spec.ts](file:///c:/Users/josh-/OneDrive/Documentos/CICLO8/PATRONES/TALLER/CMS-API/test/posts.e2e-spec.ts) (Nuevo): Set de pruebas E2E que cubre todos los escenarios de creación definidos en la spec.

---

## Detalles de Implementación y Reglas de Negocio

### 1. Campos Obligatorios (`title` y `content`)
Los campos `title` y `content` son requeridos. Si alguno de los dos falta o viene vacío en el body, el `ValidationPipe` global intercepta la petición antes de llegar al controlador y devuelve una respuesta `422 Unprocessable Entity` con el detalle del campo que falló.

> [!IMPORTANT]
> El error se formatea en el esquema estándar de Spec 0, con la clave `details` indicando exactamente qué campo falló y por qué.

### 2. Status por Defecto (`draft`)
Si el body no incluye el campo `status`, el servicio lo asigna automáticamente como `"draft"`. Los únicos valores válidos para el campo son: `draft`, `publish`, `pending`, `private` y `trash`.

### 3. Auto-generación de Slug
Si el body no incluye el campo `slug` (o viene vacío), el servicio lo genera automáticamente a partir del `title` mediante una función `slugify` privada:
- Convierte el texto a minúsculas.
- Reemplaza espacios y caracteres no alfanuméricos por `-`.
- **Ejemplo:** `"Mi Primer Post!"` → `"mi-primer-post"`.

Si el slug generado (o el enviado explícitamente) ya existe en la base de datos, se retorna un error `422` con un mensaje descriptivo sobre el conflicto.

### 4. Manejo de `published_at`
- Si el post se crea con `status = "publish"`, se registra `published_at` con el timestamp actual al momento de la creación.
- En cualquier otro estado, `published_at` se almacena como `null`.

### 5. Autenticación Requerida (JWT)
El endpoint `POST /posts` está protegido por `JwtAuthGuard`. Una petición sin token JWT válido recibe una respuesta `401 Unauthorized`. El `author_id` del post creado se asigna automáticamente a partir del ID del usuario autenticado en el token, por lo que no debe enviarse en el body.

---

## Ejecución de Pruebas E2E

Las pruebas E2E validan todos los flujos de negocio definidos. Puedes ejecutar el set completo de pruebas utilizando el siguiente comando:

```bash
npm run test:e2e
```

Los casos cubiertos son:

| # | Descripción | Status esperado |
|---|---|---|
| 1 | Creación exitosa con `title` y `content` válidos | `201` |
| 2 | Auto-generación correcta del `slug` desde el `title` | `201` |
| 3 | Falta `title` → error de validación | `422` |
| 4 | Falta `content` → error de validación | `422` |
| 5 | Sin `status` → el post se crea con `status = "draft"` | `201` |
| 6 | Sin token JWT → acceso denegado | `401` |
