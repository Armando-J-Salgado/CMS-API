# Walkthrough: Especificación 5 - Delete Post (DELETE)

Este documento detalla la implementación y el funcionamiento de la funcionalidad de eliminación de publicaciones (`DELETE /posts/{id}`) del CMS API utilizando NestJS, de acuerdo con la [Especificación 5](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/doc/ai/specs/spec5.md).

## Estructura de Archivos Creados y Modificados

- [posts.controller.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/posts/posts.controller.ts) (Modificado): Añadido endpoint `@Delete(':id')` con soporte para soft-delete y force-delete mediante query parameter `?force=true`.
- [posts.service.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/posts/posts.service.ts) (Modificado): Nuevos métodos `softDelete` y `forceDelete` para gestionar ambas operaciones con validación de autoría.
- [posts-delete.e2e-spec.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/test/posts-delete.e2e-spec.ts) (Nuevo): Set de pruebas E2E validando soft/force delete y permisos de autor.

---

## Detalles de Implementación y Reglas de Negocio

### 1. Modos de Eliminación
- **Soft-delete (por defecto)**: El post cambia su estado a `trash` y se actualiza el campo `deleted_at`. Es una operación idempotente, si ya está en `trash` devuelve `204 No Content` sin cambios.
- **Force-delete (`?force=true`)**: El registro es eliminado permanentemente de la base de datos sin importar el estado actual del post.

### 2. Reglas de Autorización
- El endpoint está protegido por `JwtAuthGuard` por lo que exige un token válido.
- Solo el **autor del post** puede eliminarlo (ya sea soft o force delete). Cualquier otro usuario recibe `403 Forbidden`.
- Si el post es legado y no tiene autor (`author_id = null`), cualquier usuario autenticado puede eliminarlo.

### 3. Respuestas y Errores
El endpoint responde siempre con un `204 No Content` en caso de éxito. Los errores pueden ser:
- `401 Unauthorized` por falta de token.
- `403 Forbidden` si no se tienen permisos.
- `404 Not Found` si el post no existe.

---

## Ejecución de Pruebas E2E

Las pruebas E2E validan la eliminación de los posts en todas las combinaciones posibles de usuarios y modos. Puedes ejecutar el set completo de pruebas utilizando el siguiente comando:

```bash
npm run test:e2e
```
