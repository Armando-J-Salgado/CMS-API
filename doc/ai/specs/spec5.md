# Especificación 5: Delete Post (DELETE)

## 1. Visión General
Esta especificación detalla la implementación del endpoint de eliminación de publicaciones (`DELETE /api/posts/:id`) para el CMS API utilizando NestJS. El sistema soporta dos modos de eliminación:

- **Soft-delete (por defecto):** El post se mueve a estado `trash`, permitiendo recuperación posterior.
- **Force-delete (`?force=true`):** El post se elimina permanentemente de la base de datos sin posibilidad de recuperación.

Ambos modos requieren autenticación JWT y validación de propiedad, consistente con las reglas de autorización definidas en Spec 2-3.

---

## 2. Reglas de Negocio

### 2.1 Soft-Delete (por defecto)
| Regla | Descripción |
|---|---|
| JWT obligatorio | Se aplica `JwtAuthGuard`. Sin token válido → `401 Unauthorized`. |
| Solo el autor elimina | Si `req.user.id !== post.author_id` → `403 Forbidden`. |
| Posts legacy (`author_id = null`) | Cualquier usuario autenticado puede eliminar un post sin dueño. |
| Transición a `trash` | El `status` del post se cambia a `trash`. |
| `deleted_at` se setea | Se asigna la fecha y hora actual al campo `deleted_at`. |
| Idempotencia | Si el post **ya está en `trash`**, se devuelve `204 No Content` sin modificar el post — la operación es idempotente. |
| Respuesta exitosa | `204 No Content` — sin body en la respuesta. |

### 2.2 Force-Delete (`?force=true`)
| Regla | Descripción |
|---|---|
| JWT obligatorio | Se aplica `JwtAuthGuard`. Sin token válido → `401 Unauthorized`. |
| Solo el autor elimina | Si `req.user.id !== post.author_id` → `403 Forbidden`. |
| Posts legacy (`author_id = null`) | Cualquier usuario autenticado puede eliminar permanentemente un post sin dueño. |
| Eliminación permanente | El registro se elimina completamente de la base de datos (`DELETE FROM posts WHERE id = ?`). |
| Aplica en cualquier estado | El force-delete funciona sin importar el estado actual del post (`draft`, `publish`, `trash`, etc.). |
| Respuesta exitosa | `204 No Content` — sin body en la respuesta. |

### 2.3 Tabla de decisión — Delete

| Estado actual | `force` | `req.user` es autor | Resultado |
|---|---|---|---|
| `draft` | `false` | ✅ | `204` — post pasa a `trash`, `deleted_at` se setea |
| `publish` | `false` | ✅ | `204` — post pasa a `trash`, `deleted_at` se setea |
| `pending` | `false` | ✅ | `204` — post pasa a `trash`, `deleted_at` se setea |
| `private` | `false` | ✅ | `204` — post pasa a `trash`, `deleted_at` se setea |
| `trash` | `false` | ✅ | `204` — idempotente, sin cambios |
| cualquiera | `true` | ✅ | `204` — post eliminado permanentemente de la BD |
| cualquiera | cualquiera | ❌ | `403 Forbidden` |
| cualquiera | cualquiera | sin token | `401 Unauthorized` |
| inexistente | cualquiera | cualquiera | `404 Not Found` |

---

## 3. Endpoint

### 3.1 `DELETE /api/posts/:id`
- **Propósito:** Eliminación de un post (soft-delete por defecto, force-delete con query param).
- **Query Params:**
  - `force` (opcional, boolean): Si es `true`, elimina permanentemente el post. Por defecto es `false`.
- **Autenticación:** JWT requerido (`@UseGuards(JwtAuthGuard)`).
- **Respuesta Exitosa:** `204 No Content` (sin body).
- **Errores:**
  - `401 Unauthorized` — Token faltante o inválido.
  - `403 Forbidden` — El usuario autenticado no es el autor del post.
  - `404 Not Found` — El post con el ID especificado no existe.

---

## 4. Formato de Errores

Reutiliza el envelope estándar de Spec 0 (Foundation):

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Unauthorized",
  "details": {}
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "No tienes permiso para eliminar este post.",
  "details": {}
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Post con ID {id} no encontrado.",
  "details": {}
}
```

---

## 5. Archivos Modificados / Creados

- `src/posts/posts.service.ts` (Modificado)
  - Nuevo método `softDelete(id: number, currentUserId: number): Promise<void>`.
  - Nuevo método `forceDelete(id: number, currentUserId: number): Promise<void>`.
  - Ambos métodos contienen la validación de existencia y propiedad.
- `src/posts/posts.controller.ts` (Modificado)
  - `@Delete(':id')` configurado con `JwtAuthGuard`, `ParseIntPipe` para el ID y un `@Query('force')` para el parámetro de eliminación forzada.
  - Documentación Swagger añadida con posibles respuestas (204, 401, 403, 404).
- `test/posts-delete.e2e-spec.ts` (Nuevo)
  - Tests E2E para todos los escenarios descritos en la sección 6.

---

## 6. Escenarios de Pruebas (E2E)

| # | Escenario | Query | Resultado Esperado |
|---|---|---|---|
| 1 | Soft-delete de un post en `draft` | — | `204 No Content`, post en BD con `status = 'trash'` y `deleted_at` seteado |
| 2 | Soft-delete de un post en `publish` | — | `204 No Content`, post en BD con `status = 'trash'` y `deleted_at` seteado |
| 3 | Soft-delete de un post que ya está en `trash` (idempotencia) | — | `204 No Content`, sin cambios en la BD |
| 4 | Force-delete de un post | `?force=true` | `204 No Content`, post ya no existe en la BD |
| 5 | Force-delete de un post que está en `trash` | `?force=true` | `204 No Content`, post ya no existe en la BD |
| 6 | Delete sin token de autenticación | — | `401 Unauthorized` |
| 7 | Delete con token de otro usuario (no es el autor) | — | `403 Forbidden` |
| 8 | Force-delete con token de otro usuario | `?force=true` | `403 Forbidden` |
| 9 | Delete de un post inexistente | — | `404 Not Found` |
| 10 | Delete de un post legacy (`author_id = null`) por usuario autenticado | — | `204 No Content`, post en BD con `status = 'trash'` |
| 11 | Force-delete de un post legacy (`author_id = null`) por usuario autenticado | `?force=true` | `204 No Content`, post ya no existe en la BD |

---

## 7. Fuera de Alcance

- Eliminación en lote (bulk delete).
- Vaciado automático de la papelera (auto-purge).
- Roles y permisos (admin puede eliminar posts de otros).
- Restauración de posts desde trash (ya cubierto en Spec 4 — Update via `PATCH` cambiando status).
- Cascada de eliminación de recursos asociados (comentarios, media, etc.).

---

## 8. Criterios de Aceptación

- `DELETE /api/posts/:id` requiere JWT y valida propiedad del autor.
- Sin `?force=true`: el post pasa a estado `trash` y se setea `deleted_at`.
- Con `?force=true`: el post se elimina permanentemente de la BD.
- Si el post ya está en `trash` y no se usa force, la respuesta es `204` sin cambios.
- Solo el autor o un usuario autenticado (para posts legacy) puede eliminar.
- La respuesta exitosa siempre es `204 No Content`.
- Todos los errores siguen el formato estándar de Spec 0.
- Tests E2E cubren: soft-delete, force-delete, idempotencia, 401, 403, 404 y posts legacy.
