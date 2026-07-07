# Plan de Implementación — Spec 1-1: Index Auth — GET /posts

Este plan detalla la implementación de la autorización JWT en el endpoint de listado de posts (`GET /api/posts`). Se encarga de proteger las publicaciones privadas y no publicadas de cada autor.

## Preguntas Abiertas / Decisiones

1. **Peticiones anónimas a estados restringidos**:
   - Si no hay JWT y se solicita `status` en (`draft`, `pending`, `private`, `trash`), devolver `401 Unauthorized`.
2. **Consultar estados restringidos de otro autor**:
   - Si un usuario autenticado `X` solicita `status=draft` y especifica `author=Y` (donde `Y !== X`), devolver `403 Forbidden`.
3. **Posts legacy (`author_id = null`) con estado restringido**:
   - Si un usuario autenticado `X` solicita `status=draft`, verá sus propios posts y también posts legacy sin dueño (`author_id = null`).

---

## Cambios Propuestos

### Componente: Controller

- Guard: Usar `@UseGuards(OptionalJwtAuthGuard)` en `findAll`.
- Req: Pasar `req.user?.id` al método `findAll` del service.

### Componente: Service

- Firma: Cambiar `findAll(query: GetPostsQueryDto, currentUserId?: number)`.
- Lógica de visibilidad:
  - Si el estado no es `publish`, validar `currentUserId` (sino, lanzar 401).
  - Si se pasa un `author` y no coincide con `currentUserId`, lanzar 403.
  - Modificar query builder para que si el estado no es `publish`, se filtre por `(post.author_id = :currentUserId OR post.author_id IS NULL)`.

### Componente: Tests

- Agregar tests en `test/posts-index.e2e-spec.ts` para cubrir:
  - Ver drafts propios (200).
  - Ver drafts propios con author explícito (200).
  - Ver drafts de forma anónima (401).
  - Ver drafts de otro autor (403).
  - Ver posts trashed propios (200).
  - Ver posts trashed de otro autor (403).
  - Ver posts legacy draft propios (200).

---

## Plan de Verificación

### Tests Automatizados

```bash
npm run test:e2e -- test/posts-index.e2e-spec.ts
```
