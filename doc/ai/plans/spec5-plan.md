# Plan de Implementación: Spec 5 — Delete Post (NestJS)

Este documento detalla los pasos para implementar el endpoint de eliminación de posts (`DELETE /api/posts/:id`) del CMS API utilizando NestJS, de acuerdo con la [spec5.md](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/doc/ai/specs/spec5.md).

## Alcance del Plan

Implementar el verbo `DELETE` sobre el recurso `/api/posts/:id`, incluyendo:

- Soft-delete por defecto: cambiar estado a `trash` y setear `deleted_at`.
- Force-delete con `?force=true`: eliminación permanente del registro en la BD.
- Idempotencia: si el post ya está en `trash`, responder `204` sin modificar.
- Autorización JWT con validación de propiedad del autor.
- Tests E2E en archivo separado.

---

## Tareas a Realizar

### 1. Implementar la lógica de negocio en `PostsService`

Agregar dos nuevos métodos en [posts.service.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/posts/posts.service.ts):

#### `softDelete(id: number, currentUserId: number): Promise<void>`

1. Buscar el post por ID → si no existe, lanzar `NotFoundException`.
2. Validar propiedad: si `post.author_id !== null && post.author_id !== currentUserId` → lanzar `ForbiddenException("No tienes permiso para eliminar este post.")`.
3. Si el post ya tiene `status = 'trash'` → retornar sin hacer nada (idempotente).
4. Cambiar `status` a `'trash'`.
5. Setear `deleted_at` a `new Date()`.
6. Guardar con `this.postRepository.save(post)`.

#### `forceDelete(id: number, currentUserId: number): Promise<void>`

1. Buscar el post por ID → si no existe, lanzar `NotFoundException`.
2. Validar propiedad: misma lógica que soft-delete.
3. Eliminar el registro con `this.postRepository.remove(post)`.

> [!TIP]
> Ambos métodos reutilizan la misma lógica de validación de existencia y propiedad. Considerar extraer un método privado `validateOwnership(post, currentUserId)` para evitar duplicación.

---

### 2. Implementar el endpoint en `PostsController`

Agregar en [posts.controller.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/posts/posts.controller.ts):

```typescript
@Delete(':id')
@UseGuards(JwtAuthGuard)
@HttpCode(HttpStatus.NO_CONTENT)
@ApiOperation({ summary: 'Delete a post (soft-delete or force-delete)' })
@ApiParam({ name: 'id', type: 'number', description: 'The unique ID of the post' })
@ApiQuery({ name: 'force', required: false, type: 'boolean', description: 'If true, permanently deletes the post' })
@ApiResponse({ status: 204, description: 'Post deleted successfully.' })
@ApiResponse({ status: 401, description: 'Unauthorized.' })
@ApiResponse({ status: 403, description: 'Forbidden — not the post author.' })
@ApiResponse({ status: 404, description: 'Post not found.' })
async delete(
  @Param('id', ParseIntPipe) id: number,
  @Query('force') force: string,
  @Req() req: any,
): Promise<void> {
  if (force === 'true') {
    return this.postsService.forceDelete(id, req.user.id);
  }
  return this.postsService.softDelete(id, req.user.id);
}
```

**Imports a agregar:** `Delete`, `Query` de `@nestjs/common` y `ApiQuery` de `@nestjs/swagger`.

---

### 3. Agregar decoradores Swagger

En el endpoint `DELETE`, agregar los decoradores de `@nestjs/swagger` para documentar:

- `@ApiOperation`: Descripción del endpoint.
- `@ApiParam`: Parámetro `id`.
- `@ApiQuery`: Parámetro `force` (opcional, boolean).
- `@ApiResponse`: Códigos 204, 401, 403, 404.

---

### 4. Implementar tests E2E

Crear el archivo [posts-delete.e2e-spec.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/test/posts-delete.e2e-spec.ts) siguiendo el mismo patrón de setup que [posts-update.e2e-spec.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/test/posts-update.e2e-spec.ts):

| # | Escenario | Query | Resultado Esperado |
|---|---|---|---|
| 1 | Soft-delete de un post en `draft` | — | `204`, post en BD con `status = 'trash'` y `deleted_at` seteado |
| 2 | Soft-delete de un post en `publish` | — | `204`, post en BD con `status = 'trash'` y `deleted_at` seteado |
| 3 | Soft-delete de un post ya en `trash` (idempotencia) | — | `204`, sin cambios en BD |
| 4 | Force-delete de un post | `?force=true` | `204`, post no existe en BD |
| 5 | Force-delete de un post en `trash` | `?force=true` | `204`, post no existe en BD |
| 6 | Delete sin token | — | `401` |
| 7 | Delete de post ajeno | — | `403` |
| 8 | Force-delete de post ajeno | `?force=true` | `403` |
| 9 | Delete de post inexistente | — | `404` |
| 10 | Delete de post legacy (`author_id = null`) | — | `204`, post en BD con `status = 'trash'` |
| 11 | Force-delete de post legacy | `?force=true` | `204`, post no existe en BD |

> [!IMPORTANT]
> Los tests TDD se escriben **primero** (en rojo) y luego se implementa la lógica para ponerlos en verde. El orden de ejecución será:
> 1. Crear `posts-delete.e2e-spec.ts` con todos los tests.
> 2. Verificar que todos fallan (rojo).
> 3. Implementar `softDelete()` y `forceDelete()` en el service.
> 4. Implementar el endpoint `DELETE` en el controller.
> 5. Verificar que todos pasan (verde).

---

## Archivos a Modificar / Crear

| Archivo | Acción | Descripción |
|---|---|---|
| `src/posts/posts.service.ts` | Modificar | Agregar `softDelete()`, `forceDelete()` y posiblemente `validateOwnership()` privado |
| `src/posts/posts.controller.ts` | Modificar | Agregar endpoint `@Delete(':id')` con guard, query param y Swagger |
| `test/posts-delete.e2e-spec.ts` | **Crear** | Tests E2E para todos los escenarios de eliminación |

---

## Verificación

### Tests automáticos
```bash
# Ejecutar solo los tests de delete
npx jest --config test/jest-e2e.json --testPathPattern=posts-delete

# Ejecutar todos los tests E2E para verificar que no hay regresión
npm run test:e2e
```

### Verificación manual
- Probar el endpoint via Swagger UI en `http://localhost:3000/api`.
- Verificar que la BD refleja los cambios esperados tras soft-delete y force-delete.
