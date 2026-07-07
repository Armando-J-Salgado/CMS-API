# Walkthrough: Especificación 2 - Users, Authentication & Show Post

Este documento detalla la implementación y el funcionamiento de la funcionalidad de usuarios, autenticación y visualización de publicaciones (`GET /posts/{id}`) del CMS API utilizando NestJS, de acuerdo con las [Especificación 2-1](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/doc/ai/specs/spec2-1.md), [Especificación 2-2](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/doc/ai/specs/spec2-2.md) y [Especificación 2-3](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/doc/ai/specs/spec2-3.md).

## Estructura de Archivos Creados y Modificados

- [users.service.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/users/users.service.ts) (Nuevo): Servicio para el manejo de usuarios.
- [user.entity.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/users/entities/user.entity.ts) (Nuevo): Entidad de base de datos para los usuarios.
- [auth.controller.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/auth/auth.controller.ts) (Nuevo): Controlador con los endpoints `/auth/register` y `/auth/login`.
- [auth.service.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/auth/auth.service.ts) (Nuevo): Servicio para autenticación y generación de JWT.
- [jwt-auth.guard.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/auth/guards/jwt-auth.guard.ts) (Nuevo): Guard que exige JWT válido.
- [optional-jwt-auth.guard.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/auth/guards/optional-jwt-auth.guard.ts) (Nuevo): Guard opcional para permitir consultas anónimas.
- [posts.controller.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/posts/posts.controller.ts) (Modificado): Endpoints protegidos con Guards, adición de `GET /posts/:id` y `GET /posts/:id/trash`.
- [posts.service.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/posts/posts.service.ts) (Modificado): Integración del `author_id` del usuario autenticado en la creación y actualización.

---

## Detalles de Implementación y Reglas de Negocio

### 1. Usuarios y Autenticación
El sistema permite a los usuarios registrarse (`/auth/register`) con un email y contraseña, e iniciar sesión (`/auth/login`) para obtener un token JWT. Este JWT es necesario para las acciones que requieren autoría.

### 2. Visibilidad de Posts (Show)
El endpoint `GET /posts/:id` utiliza `OptionalJwtAuthGuard`.
- Si el post es `publish`, cualquiera (incluso anónimos) puede verlo (`200 OK`).
- Si es `draft`, `pending`, o `private`, **sólo** el autor puede verlo (`200 OK`). Si no es el autor, devuelve `403 Forbidden`.
- Los posts en estado `trash` no son accesibles a través de este endpoint, devolviendo `404 Not Found` (incluso para el autor).

### 3. Autenticación en Crear y Actualizar
La creación (`POST /posts`) y actualización (`PATCH/PUT /posts/:id`) ahora requieren un JWT válido (`JwtAuthGuard`).
- **Crear**: El `author_id` se asigna automáticamente a partir del ID del usuario autenticado en el token.
- **Actualizar**: Sólo el autor original del post puede actualizarlo. Un usuario autenticado puede actualizar un post si es suyo (`200 OK`) o si el post no tiene dueño (`author_id = null`), en cuyo caso reclama la autoría.

---

## Ejecución de Pruebas E2E

Las pruebas E2E validan todos los flujos de autenticación, visualización y permisos. Puedes ejecutar el set completo de pruebas utilizando el siguiente comando:

```bash
npm run test:e2e
```
