# Walkthrough: Especificación 6 - Restore Post & View Trashed Post

Este documento detalla la implementación y el funcionamiento de la restauración de publicaciones y su vista en papelera (`POST /posts/{id}/restore` y `GET /posts/{id}/trash`) del CMS API utilizando NestJS, de acuerdo con la [Especificación 6](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/doc/ai/specs/spec6.md).

## Estructura de Archivos Creados y Modificados

- [posts.controller.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/posts/posts.controller.ts) (Modificado): Exposición formal del endpoint `GET /posts/:id/trash` y creación del nuevo endpoint `POST /posts/:id/restore`.
- [posts.service.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/posts/posts.service.ts) (Modificado): Implementación del método `restore()` que devuelve el post a `draft` y limpia el `deleted_at`.
- [posts-delete.e2e-spec.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/test/posts-delete.e2e-spec.ts) (Modificado): Adición de pruebas para los flujos de restauración y vistas de papelera.

---

## Detalles de Implementación y Reglas de Negocio

### 1. Restaurar un post (`POST /api/posts/:id/restore`)
- Permite devolver un post que se encontraba en estado `trash` de vuelta al estado `draft`.
- Se requiere token de autenticación (`JwtAuthGuard`) y que el usuario sea el **autor del post**.
- Si el post no se encuentra en `trash`, el sistema retorna `422 Unprocessable Entity`.
- Al restaurarse con éxito, se limpia el campo `deleted_at` (pasa a ser `null`).

### 2. Ver un post en la papelera (`GET /api/posts/:id/trash`)
- Única vía para poder leer los datos de un post en estado `trash`, ya que el endpoint genérico (`GET /posts/:id`) lo oculta.
- Se requiere token de autenticación (`JwtAuthGuard`) y que el usuario sea el **autor del post**.
- A diferencia del endpoint genérico, la respuesta de este endpoint **incluye explícitamente el campo `deleted_at`** para poder auditar cuándo fue eliminado.
- Si el post existe pero no está en `trash`, devuelve `404 Not Found`.

---

## Ejecución de Pruebas E2E

Las pruebas E2E cubren la validación y protección de estas rutas, además del flujo del ciclo de vida del post con el manejo correcto de la fecha `deleted_at`. Puedes ejecutar el set completo de pruebas utilizando el siguiente comando:

```bash
npm run test:e2e
```
