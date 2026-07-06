# Plan de Implementación: Spec 4 - Update (NestJS)

Este documento detalla los pasos para implementar el endpoint de actualización de posts (`PUT /posts/{id}` y `PATCH /posts/{id}`) del CMS API utilizando NestJS, de acuerdo con las reglas de negocio del ciclo de vida de un post definidas en [GEMINI.md](file:///c:/ESEN/2026/Ciclo%20II/Patrones/CMS-API/GEMINI.md).

## Alcance del Plan

Implementar los verbos `PATCH` (actualización parcial) y `PUT` (actualización completa) sobre el recurso `/posts/{id}`, incluyendo:

- Validación de entrada con DTOs separados para cada verbo.
- Regla de bloqueo: un post en `trash` no puede actualizarse directamente.
- Validación de transiciones de `status` y retorno de `422 Unprocessable Entity` ante transiciones inválidas.
- Auto-regeneración del `slug` cuando se actualiza el `title` sin enviar `slug` explícitamente.
- Actualización automática de `updated_at` en cada modificación.
- Manejo de los campos de ciclo de vida (`published_at`, `deleted_at`) según las reglas definidas.
- Tests E2E que cubran los escenarios principales.

## Tareas a Realizar

### 1. Crear los DTOs de entrada

Crear los archivos de validación en `src/posts/dto/`:

- **`update-post.dto.ts`** — Para `PATCH`: todos los campos son opcionales. Ningún campo es obligatorio.
- **`replace-post.dto.ts`** — Para `PUT`: `title` y `content` son requeridos. El resto de campos son opcionales.

Campos a considerar en ambos DTOs: `title`, `content`, `excerpt`, `slug`, `status`, `author_id`.

### 2. Implementar la lógica de negocio en `PostsService`

Agregar el método `update(id: number, dto: UpdatePostDto | ReplacePostDto)` en `src/posts/posts.service.ts` con las siguientes reglas:

- **Verificar existencia**: si el post no existe, lanzar `NotFoundException` (404).
- **Bloqueo de trash**: si el post tiene `status = 'trash'`, rechazar la operación con `UnprocessableEntityException` (422) y mensaje `"Un post en trash no puede ser actualizado directamente. Restáuralo primero."`.
- **Validación de transición de status** (si `status` se incluye en el body):
  - Pasar a `publish` solo si `title` y `content` no están vacíos (considerando el estado resultante tras aplicar el body).
  - Cualquier otra transición inválida retorna `422`.
- **Manejo de campos de ciclo de vida**:
  - Al transicionar a `publish` por primera vez (`published_at` es `null`), setear `published_at` al timestamp actual.
  - Al transicionar a `trash`, setear `deleted_at` al timestamp actual.
  - Al salir de `trash` (restaurar), limpiar `deleted_at` (setearlo a `null`).
- **Auto-regeneración de slug**: si `title` cambia y no se envió `slug` en el body, regenerar el slug a partir del nuevo `title`.
- **`updated_at`**: TypeORM lo actualiza automáticamente via `@UpdateDateColumn()`.

### 3. Implementar los endpoints en `PostsController`

Agregar en `src/posts/posts.controller.ts`:

- `PATCH /posts/:id` — Llama al servicio con el `UpdatePostDto`.
- `PUT /posts/:id` — Llama al servicio con el `ReplacePostDto`.

Ambos retornan el recurso `Post` actualizado con `200 OK`.

### 4. Agregar decoradores Swagger

En los endpoints y DTOs, agregar los decoradores de `@nestjs/swagger` para documentar:

- Descripción de cada endpoint.
- Ejemplos de body para `PATCH` y `PUT`.
- Posibles respuestas: `200`, `400`, `404`, `422`.

### 5. Implementar tests E2E

Crear o extender el archivo de tests en `test/` con los siguientes escenarios:

| Escenario | Verbo | Resultado esperado |
|---|---|---|
| Actualización parcial de un campo (`title`) | `PATCH` | `200 OK` con el campo actualizado |
| Actualización completa con todos los campos | `PUT` | `200 OK` con el recurso reemplazado |
| `PUT` sin `title` o sin `content` | `PUT` | `400 Bad Request` |
| Post inexistente | `PATCH` / `PUT` | `404 Not Found` |
| Post en `trash` — intento de actualización | `PATCH` | `422 Unprocessable Entity` |
| Transición inválida de `status` (ej: publicar sin `content`) | `PATCH` | `422 Unprocessable Entity` |
| Actualizar `title` sin enviar `slug` | `PATCH` | `200 OK` con slug regenerado |
| Primera publicación — verificar `published_at` | `PATCH` | `200 OK` con `published_at` seteado |
