# Plan de Implementación: Spec 2-2 - Show (NestJS)

Este documento detalla los pasos para implementar `GET /posts/{id}` y `GET /posts/{id}/trash` según [spec2-2-show.md](spec2-2-show.md). Depende de Spec 0 y Spec 2-1.

## Alcance del Plan
Implementar la lógica de negocio real en `PostsController`/`PostsService` (definidos como placeholder en Spec 0), con las reglas de visibilidad por status y autoría, siguiendo TDD.

## Tareas a Realizar

### 1. `PostsService`
- Método `findById(id: number): Promise<Post | null>` — búsqueda simple por id (incluye posts en cualquier status; el filtrado por visibilidad se hace en el controller/servicio de autorización, no en la query).
- Método auxiliar `isOwner(post: Post, userId?: number): boolean`.

### 2. `PostsController`
- `GET /posts/:id` con `@UseGuards(OptionalJwtAuthGuard)`:
  1. Validar que `:id` sea numérico → si no, `400`.
  2. Buscar post → si no existe, `404`.
  3. Si `status === 'trash'` → `404` (sin importar quién pregunta).
  4. Si `status === 'publish'` → `200`.
  5. Si no es `publish` y `req.user?.id === post.author_id` → `200`.
  6. Si no es `publish` y no es el autor → `403`.
- `GET /posts/:id/trash` con `@UseGuards(JwtAuthGuard)`:
  1. Validar `:id` numérico → `400`.
  2. Buscar post → si no existe, `404`.
  3. Si `status !== 'trash'` → `404`.
  4. Si `req.user.id !== post.author_id` → `403`.
  5. Si no → `200`.

### 3. Serialización de respuesta
- Excluir `deleted_at` del payload de respuesta (usar `class-transformer` `@Exclude()` o mapeo manual en el servicio).

### 4. Manejo de Errores
- Reutilizar el filtro global de excepciones de Spec 0.
- Confirmar que `ForbiddenException` y `NotFoundException` de NestJS producen el envelope estándar.

## Tests (TDD) — extender `test/posts.e2e-spec.ts`

Requiere seed de datos: al menos 2 usuarios (autor A, no-autor B) y posts en cada status, asociados al usuario A.

| # | Caso | Requester | Resultado esperado |
|---|------|-----------|---------------------|
| 1 | GET post `publish` existente | anónimo | `200` |
| 2 | GET post `publish` existente | usuario B (no autor) | `200` |
| 3 | GET post inexistente | anónimo | `404` |
| 4 | GET post `draft` | autor A | `200` |
| 5 | GET post `draft` | usuario B | `403` |
| 6 | GET post `draft` | anónimo | `403` |
| 7 | GET post `private` | autor A | `200` |
| 8 | GET post `private` | usuario B | `403` |
| 9 | GET post `pending` | autor A | `200` |
| 10 | GET post `pending` | usuario B | `403` |
| 11 | GET post `trash` vía `/posts/:id` | autor A | `404` |
| 12 | GET post `trash` vía `/posts/:id` | usuario B | `404` |
| 13 | GET `/posts/:id` con id no numérico | cualquiera | `400` |
| 14 | GET post `trash` vía `/posts/:id/trash` | autor A | `200` |
| 15 | GET post `trash` vía `/posts/:id/trash` | usuario B | `403` |
| 16 | GET post `trash` vía `/posts/:id/trash` sin token | — | `401` |
| 17 | GET post `publish` vía `/posts/:id/trash` | autor A | `404` (no está en trash) |
| 18 | GET post inexistente vía `/posts/:id/trash` | autor A | `404` |
| 19 | Response body no incluye `deleted_at` | cualquiera con acceso válido | body sin campo `deleted_at` |

## Orden sugerido de implementación
1. Seed/fixtures de test (usuarios + posts por status).
2. Ruta principal `/posts/:id` — casos `publish` y 404 (tests 1-3).
3. Reglas de autoría para draft/private/pending (tests 4-10).
4. Exclusión de trash en ruta principal (tests 11-12).
5. Validación de `:id` (test 13).
6. Ruta `/posts/:id/trash` completa (tests 14-18).
7. Serialización — ocultar `deleted_at` (test 19).