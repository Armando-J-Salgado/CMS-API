# Plan de Implementación — Spec 2-3: Autorización JWT en Crear y Actualizar Posts

## Resumen

Integrar `JwtAuthGuard` en los endpoints de creación y actualización de posts, eliminar `author_id` del DTO de creación, y hacer obligatorio el parámetro `currentUserId` en el service. Actualizar todos los tests existentes para enviar JWT.

---

## Cambios Propuestos

### Componente: DTOs

#### [MODIFY] [create-post.dto.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20diseño/Taller%20DOE/CMS-API/src/posts/dto/create-post.dto.ts)
- Eliminar el campo `author_id` (líneas 48-51) y sus imports asociados (`IsInt`).
- El `author_id` será inyectado desde el controller, no desde el body del request.

---

### Componente: Service

#### [MODIFY] [posts.service.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20diseño/Taller%20DOE/CMS-API/src/posts/posts.service.ts)

**Método `create()`:**
- Cambiar firma de `create(dto: CreatePostDto)` → `create(dto: CreatePostDto, userId: number)`.
- Reemplazar `author_id: dto.author_id ?? null` → `author_id: userId`.

**Método `update()`:**
- Cambiar firma de `update(id, dto, currentUserId?: number)` → `update(id, dto, currentUserId: number)`.
- Eliminar la condición `currentUserId !== undefined` del guard de propiedad (línea 77), ya que ahora siempre se recibe.
- La lógica queda:
  ```typescript
  if (post.author_id !== null && post.author_id !== currentUserId) {
    throw new ForbiddenException("No tienes permiso para modificar este post.");
  }
  ```

---

### Componente: Controller

#### [MODIFY] [posts.controller.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20diseño/Taller%20DOE/CMS-API/src/posts/posts.controller.ts)

**`POST /posts` (método `create`):**
- Agregar `@UseGuards(JwtAuthGuard)`.
- Agregar `@Req() req: any` al método.
- Pasar `req.user.id` al service: `this.postsService.create(dto, req.user.id)`.
- Agregar `@ApiResponse({ status: 401, description: 'Unauthorized' })`.

**`PATCH /posts/:id` (método `update`):**
- Agregar `@UseGuards(JwtAuthGuard)`.
- Agregar `@Req() req: any` al método.
- Pasar `req.user.id` al service: `this.postsService.update(id, dto, req.user.id)`.
- Agregar `@ApiResponse({ status: 401 })` y `@ApiResponse({ status: 403 })`.

**`PUT /posts/:id` (método `replace`):**
- Agregar `@UseGuards(JwtAuthGuard)`.
- Agregar `@Req() req: any` al método.
- Pasar `req.user.id` al service: `this.postsService.update(id, dto, req.user.id)`.
- Agregar `@ApiResponse({ status: 401 })` y `@ApiResponse({ status: 403 })`.

---

### Componente: Tests

#### [MODIFY] [posts.e2e-spec.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20diseño/Taller%20DOE/CMS-API/test/posts.e2e-spec.ts)

- Los tests de creación ya tienen infraestructura de JWT (users, tokens, `jwtService`).
- Actualizar los tests de `POST /api/posts` para enviar `Authorization: Bearer <authorToken>`.
- Verificar que el post creado tiene `author_id` igual al `id` del usuario autenticado.
- Agregar test: `POST /api/posts` sin token → `401`.
- Agregar test: verificar que `author_id` enviado en body se ignora (ya no está en el DTO).

#### [MODIFY] [posts-update.e2e-spec.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20diseño/Taller%20DOE/CMS-API/test/posts-update.e2e-spec.ts)

- Agregar infraestructura de JWT al test file (imports de `JwtService`, `User`, creación de usuarios, generación de tokens).
- Agregar `User` repository y limpiar en `beforeEach`.
- Actualizar **todos** los tests existentes de PATCH/PUT para enviar `Authorization: Bearer <token>`.
- Crear posts con `author_id` vinculado al usuario de prueba.
- Agregar nuevos tests:
  - `PATCH /api/posts/:id` sin token → `401 Unauthorized`.
  - `PUT /api/posts/:id` sin token → `401 Unauthorized`.
  - `PATCH /api/posts/:id` de post ajeno → `403 Forbidden`.
  - `PUT /api/posts/:id` de post ajeno → `403 Forbidden`.
  - `PATCH /api/posts/:id` de post con `author_id = null` → `200 OK` (cualquier user autenticado).
  - `PATCH /api/posts/:id` transferencia de autoría por el autor actual → `200 OK`.

---

## Orden de Ejecución

1. **DTO**: Modificar `CreatePostDto` (eliminar `author_id`).
2. **Service**: Actualizar firmas de `create()` y `update()`.
3. **Controller**: Agregar guards, `@Req()`, y pasar `userId`.
4. **Tests `posts.e2e-spec.ts`**: Actualizar tests de creación con JWT.
5. **Tests `posts-update.e2e-spec.ts`**: Actualizar tests de update con JWT + nuevos tests de autorización.
6. **Verificación**: Ejecutar `npm run test:e2e` y confirmar que todos pasan.

---

## Plan de Verificación

### Tests Automatizados
```bash
npx jest --config test/jest-e2e.json --verbose
```

### Verificación Manual (opcional)
- Probar con Swagger UI (`/api/docs`) enviando requests con y sin `Authorization` header.
- Verificar que la respuesta de creación incluye el `author_id` correcto.
