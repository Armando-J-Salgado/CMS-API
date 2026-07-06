# Especificación 6: Restore Post & View Trashed Post

## 1. Visión General

Esta especificación extiende el ciclo de vida de un post para cubrir dos capacidades nuevas:

1. **Restaurar un post desde `trash`** — un endpoint dedicado `POST /api/posts/:id/restore` que saca el post del estado `trash` de vuelta a `draft`, limpiando `deleted_at`.
2. **Ver los detalles de un post en `trash`** — el endpoint `GET /api/posts/:id/trash` (ya implementado en el controlador) es documentado, testeado y expuesto formalmente en este spec.

Ambas operaciones requieren autenticación JWT y validan la propiedad del autor, siguiendo las mismas convenciones establecidas en Spec 2-3 y Spec 5.

---

## 2. User Stories

| ID  | Historia                                                                                      |
|-----|-----------------------------------------------------------------------------------------------|
| US1 | Como usuario quiero restaurar un post que ha sido eliminado de forma suave (soft-deleted).    |
| US2 | Como autor del post quiero ser el único que puede restaurar mi post.                          |
| US3 | Como usuario quiero ver los detalles de un post que está actualmente en `trash`.              |
| US4 | Como usuario quiero que el campo `deleted_at` se actualice siempre que haga soft-delete o restaure un post. |

---

## 3. Reglas de Negocio

### 3.1 Restaurar un post (`POST /api/posts/:id/restore`)

| Regla | Descripción |
|---|---|
| JWT obligatorio | Se aplica `JwtAuthGuard`. Sin token válido → `401 Unauthorized`. |
| Solo el autor restaura | Si `post.author_id !== null && post.author_id !== req.user.id` → `403 Forbidden`. |
| Posts legacy (`author_id = null`) | Cualquier usuario autenticado puede restaurar un post sin dueño (simetría con el comportamiento de delete). |
| Solo posts en `trash` | Si el post **no está en `trash`** → `422 Unprocessable Entity` ("El post no está en trash y no puede ser restaurado."). |
| Transición de estado | El `status` del post se cambia a `"draft"`. |
| `deleted_at` se limpia | El campo `deleted_at` se setea a `null`. |
| Respuesta exitosa | `200 OK` con el body del post restaurado. |

### 3.2 Ver un post en `trash` (`GET /api/posts/:id/trash`)

| Regla | Descripción |
|---|---|
| JWT obligatorio | Se aplica `JwtAuthGuard`. Sin token válido → `401 Unauthorized`. |
| Solo el autor puede ver | Si `post.author_id !== null && post.author_id !== req.user.id` → `403 Forbidden`. |
| Solo posts en `trash` | Si el post existe pero **no está en `trash`** → `404 Not Found`. |
| Post inexistente | Si el post no existe → `404 Not Found`. |
| Campos expuestos | El campo `deleted_at` **se incluye** en la respuesta de este endpoint (a diferencia del endpoint estándar). |
| Respuesta exitosa | `200 OK` con el body del post, incluyendo `deleted_at`. |

### 3.3 Comportamiento de `deleted_at` (US4)

| Acción | Resultado en `deleted_at` |
|---|---|
| Soft-delete (spec 5) | Se setea a `new Date()` (la fecha y hora actuales). |
| Restaurar (spec 6) | Se setea a `null`. |

### 3.4 Tabla de decisión — Restore

| Estado actual | `req.user` es autor | Resultado |
|---|---|---|
| `trash` | ✅ | `200 OK` — post pasa a `draft`, `deleted_at = null` |
| `draft`, `publish`, `pending`, `private` | ✅ | `422 Unprocessable Entity` |
| `trash` | ❌ (no es autor) | `403 Forbidden` |
| Post inexistente | cualquiera | `404 Not Found` |
| cualquiera | sin token | `401 Unauthorized` |

---

## 4. Endpoints

### 4.1 `POST /api/posts/:id/restore`
- **Propósito:** Restaurar un post eliminado suavemente (en `trash`) de vuelta a `draft`.
- **Autenticación:** JWT requerido (`@UseGuards(JwtAuthGuard)`).
- **Respuesta Exitosa:** `200 OK` con el body del post restaurado.
- **Errores:**
  - `401 Unauthorized` — Token faltante o inválido.
  - `403 Forbidden` — El usuario autenticado no es el autor del post.
  - `404 Not Found` — El post con el ID especificado no existe.
  - `422 Unprocessable Entity` — El post no está en `trash`.

### 4.2 `GET /api/posts/:id/trash`
- **Propósito:** Obtener los detalles de un post que se encuentra en estado `trash`.
- **Autenticación:** JWT requerido (`@UseGuards(JwtAuthGuard)`).
- **Respuesta Exitosa:** `200 OK` con el body del post, incluyendo el campo `deleted_at`.
- **Errores:**
  - `401 Unauthorized` — Token faltante o inválido.
  - `403 Forbidden` — El usuario autenticado no es el autor del post.
  - `404 Not Found` — El post no existe o no está en `trash`.

---

## 5. Formato de Respuestas

### Respuesta exitosa de restauración (`200 OK`)
```json
{
  "id": 1,
  "title": "Mi Post",
  "content": "Contenido del post.",
  "excerpt": null,
  "slug": "mi-post",
  "status": "draft",
  "author_id": 5,
  "created_at": "2026-07-01T10:00:00.000Z",
  "updated_at": "2026-07-06T15:30:00.000Z",
  "published_at": null
}
```
> **Nota:** `deleted_at` no aparece en la respuesta de restore (el `@Exclude()` de la entidad lo oculta). El campo se expone únicamente en el endpoint `GET /:id/trash`.

### Respuesta exitosa de ver post en trash (`200 OK`)
```json
{
  "id": 1,
  "title": "Mi Post Eliminado",
  "content": "Contenido.",
  "excerpt": null,
  "slug": "mi-post-eliminado",
  "status": "trash",
  "author_id": 5,
  "created_at": "2026-07-01T10:00:00.000Z",
  "updated_at": "2026-07-06T15:30:00.000Z",
  "published_at": null,
  "deleted_at": "2026-07-06T14:00:00.000Z"
}
```

---

## 6. Formato de Errores

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
  "message": "No tienes permiso para restaurar este post.",
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

### 422 Unprocessable Entity
```json
{
  "error": "Unprocessable Entity",
  "message": "El post no está en trash y no puede ser restaurado.",
  "details": {}
}
```

---

## 7. Archivos Modificados / Creados

- `src/posts/posts.service.ts` (Modificado)
  - Nuevo método `restore(id: number, currentUserId: number): Promise<Post>`.
  - Lógica: buscar post, validar existencia (404), validar propiedad (403), validar estado `trash` (422), cambiar `status` a `"draft"`, setear `deleted_at = null`, guardar y retornar el post actualizado.
- `src/posts/posts.controller.ts` (Modificado)
  - Nuevo endpoint `@Post(':id/restore')` con `JwtAuthGuard`, `ParseIntPipe` e inyección del usuario desde `req`.
  - Decoradores Swagger formales añadidos al endpoint `GET /:id/trash` existente.
  - El handler `findOneTrash` devuelve el objeto con `deleted_at` visible (retornando el objeto plano o usando un interceptor custom).
- `test/posts-delete.e2e-spec.ts` (Modificado)
  - Nuevos tests E2E para todos los escenarios de restauración y vista de post en trash (ver sección 8).

---

## 8. Escenarios de Pruebas (E2E) — Adiciones a `posts-delete.e2e-spec.ts`

### 8.1 Restore (`POST /api/posts/:id/restore`)

| #  | Escenario                                                              | Resultado Esperado                                                    |
|----|------------------------------------------------------------------------|-----------------------------------------------------------------------|
| 12 | Restore de un post en `trash` por su autor                             | `200 OK`, `status = 'draft'`, `deleted_at = null` en BD              |
| 13 | Restore limpia `deleted_at` — verificar que la respuesta no incluye `deleted_at` | `200 OK`, campo `deleted_at` ausente o `null` en respuesta    |
| 14 | Restore de un post que **no está en `trash`** (estado `draft`)         | `422 Unprocessable Entity`                                            |
| 15 | Restore de un post que **no está en `trash`** (estado `publish`)       | `422 Unprocessable Entity`                                            |
| 16 | Restore sin token de autenticación                                     | `401 Unauthorized`                                                    |
| 17 | Restore de post ajeno (usuario autenticado no es el autor)             | `403 Forbidden`                                                       |
| 18 | Restore de post inexistente                                            | `404 Not Found`                                                       |
| 19 | Restore de post legacy (`author_id = null`) por cualquier usuario autenticado | `200 OK`, `status = 'draft'`, `deleted_at = null`            |

### 8.2 View Trashed Post (`GET /api/posts/:id/trash`)

| #  | Escenario                                                        | Resultado Esperado                                                         |
|----|------------------------------------------------------------------|----------------------------------------------------------------------------|
| 20 | Ver un post en `trash` por su autor                              | `200 OK`, body incluye `deleted_at` con valor no nulo                      |
| 21 | Ver un post que **no está en `trash`** (e.g. `draft`)            | `404 Not Found`                                                            |
| 22 | Ver un post en `trash` sin token de autenticación                | `401 Unauthorized`                                                         |
| 23 | Ver un post en `trash` por otro usuario (no es el autor)         | `403 Forbidden`                                                            |
| 24 | Ver un post en `trash` con ID inexistente                        | `404 Not Found`                                                            |

---

## 9. Fuera de Alcance

- Restaurar a un estado diferente a `draft` (e.g., restaurar directo a `publish`).
- Restauración masiva (bulk restore).
- Vaciado automático de la papelera (auto-purge).
- Roles administrativos que puedan restaurar posts de otros usuarios.
- Paginación de posts en `trash`.

---

## 10. Criterios de Aceptación

- `POST /api/posts/:id/restore` requiere JWT y valida propiedad del autor.
- Solo los posts en estado `trash` pueden ser restaurados; cualquier otro estado devuelve `422`.
- Tras la restauración, el post tiene `status = 'draft'` y `deleted_at = null` en la BD.
- `GET /api/posts/:id/trash` requiere JWT, valida propiedad y solo funciona para posts en `trash`.
- La respuesta de `GET /api/posts/:id/trash` incluye el campo `deleted_at` (con la fecha de eliminación).
- El campo `deleted_at` en BD refleja siempre la fecha de última eliminación suave o `null` si el post fue restaurado.
- Todos los errores siguen el formato estándar de Spec 0.
- Los tests E2E en `posts-delete.e2e-spec.ts` cubren todos los escenarios de las tablas 8.1 y 8.2.
