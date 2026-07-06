# Plan de Implementación: Spec 6 — Restore Post & View Trashed Post

Este documento detalla los pasos para implementar las funcionalidades de restauración y visualización de posts en trash del CMS API, de acuerdo con la [spec6.md](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/doc/ai/specs/spec6.md).

## Alcance del Plan

Implementar dos capacidades nuevas sobre el recurso `/api/posts/:id`:

1. **`POST /api/posts/:id/restore`** — restaurar un post en `trash` a estado `draft`, limpiando `deleted_at`.
2. **`GET /api/posts/:id/trash`** — ya existe el handler en el controlador; se debe:
   - Exponer `deleted_at` en la respuesta (actualmente oculto por `@Exclude()`).
   - Añadir documentación Swagger formal.
   - Cubrir con tests E2E.

También se agregan **13 tests nuevos** al archivo `posts-delete.e2e-spec.ts` siguiendo TDD.

---

## Estado Actual del Código (Pre-implementación)

| Componente | Estado | Notas |
|---|---|---|
| `GET /api/posts/:id/trash` | ✅ Handler existe | Falta: exponer `deleted_at`, Swagger, tests |
| `POST /api/posts/:id/restore` | ❌ No existe | Requiere service + controller |
| `PostsService.restore()` | ❌ No existe | Lógica nueva completa |
| `Post.deleted_at` | `@Exclude()` global | Necesita exponerse solo en `/trash` |
| Tests E2E de restore/trash | ❌ No existen | 13 nuevos casos en `posts-delete.e2e-spec.ts` |

---

## Tareas a Realizar

### Tarea 1 — Escribir los tests E2E (TDD: Rojo primero)

**Archivo:** [posts-delete.e2e-spec.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/test/posts-delete.e2e-spec.ts)

Agregar al final del `describe("Posts Delete (e2e)", ...)` los siguientes bloques de tests:

#### Tests de Restore (escenarios #12–#19)

```typescript
// 12. Restore de un post en trash por su autor
it("POST /api/posts/:id/restore - restores a trashed post", async () => {
  const post = await postRepository.save(
    postRepository.create({
      title: "Trashed Post",
      content: "Content",
      slug: "trashed-post-restore",
      status: "trash",
      deleted_at: new Date(),
      author_id: authorId,
    }),
  );

  const res = await request(app.getHttpServer())
    .post(`/api/posts/${post.id}/restore`)
    .set("Authorization", "Bearer " + authorToken)
    .expect(200);

  expect(res.body.status).toBe("draft");

  const updated = await postRepository.findOne({ where: { id: post.id } });
  expect(updated!.status).toBe("draft");
  expect(updated!.deleted_at).toBeNull();
});

// 13. Restore limpia deleted_at — campo ausente o null en respuesta
it("POST /api/posts/:id/restore - response does not expose deleted_at", async () => {
  const post = await postRepository.save(
    postRepository.create({
      title: "Trashed Post 2",
      content: "Content",
      slug: "trashed-post-restore-2",
      status: "trash",
      deleted_at: new Date(),
      author_id: authorId,
    }),
  );

  const res = await request(app.getHttpServer())
    .post(`/api/posts/${post.id}/restore`)
    .set("Authorization", "Bearer " + authorToken)
    .expect(200);

  // deleted_at must be null or absent (excluded by @Exclude())
  expect(res.body.deleted_at === undefined || res.body.deleted_at === null).toBe(true);
});

// 14. Restore de post que no está en trash (draft)
it("POST /api/posts/:id/restore - returns 422 if post is not in trash (draft)", async () => {
  const post = await postRepository.save(
    postRepository.create({
      title: "Draft Post Restore",
      content: "Content",
      slug: "draft-post-restore",
      status: "draft",
      author_id: authorId,
    }),
  );

  await request(app.getHttpServer())
    .post(`/api/posts/${post.id}/restore`)
    .set("Authorization", "Bearer " + authorToken)
    .expect(422);
});

// 15. Restore de post que no está en trash (publish)
it("POST /api/posts/:id/restore - returns 422 if post is not in trash (publish)", async () => {
  const post = await postRepository.save(
    postRepository.create({
      title: "Publish Post Restore",
      content: "Content",
      slug: "publish-post-restore",
      status: "publish",
      author_id: authorId,
    }),
  );

  await request(app.getHttpServer())
    .post(`/api/posts/${post.id}/restore`)
    .set("Authorization", "Bearer " + authorToken)
    .expect(422);
});

// 16. Restore sin token
it("POST /api/posts/:id/restore - without token returns 401", async () => {
  const post = await postRepository.save(
    postRepository.create({
      title: "Trashed Post No Auth",
      content: "Content",
      slug: "trashed-no-auth",
      status: "trash",
      deleted_at: new Date(),
      author_id: authorId,
    }),
  );

  await request(app.getHttpServer())
    .post(`/api/posts/${post.id}/restore`)
    .expect(401);
});

// 17. Restore de post ajeno
it("POST /api/posts/:id/restore - other user returns 403", async () => {
  const post = await postRepository.save(
    postRepository.create({
      title: "Author Trashed Post",
      content: "Content",
      slug: "author-trashed-post",
      status: "trash",
      deleted_at: new Date(),
      author_id: authorId,
    }),
  );

  await request(app.getHttpServer())
    .post(`/api/posts/${post.id}/restore`)
    .set("Authorization", "Bearer " + otherToken)
    .expect(403);
});

// 18. Restore de post inexistente
it("POST /api/posts/:id/restore - non-existent returns 404", async () => {
  await request(app.getHttpServer())
    .post("/api/posts/999999/restore")
    .set("Authorization", "Bearer " + authorToken)
    .expect(404);
});

// 19. Restore de post legacy (author_id = null)
it("POST /api/posts/:id/restore - legacy post restore allowed for any authenticated user", async () => {
  const post = await postRepository.save(
    postRepository.create({
      title: "Legacy Trashed Post",
      content: "Content",
      slug: "legacy-trashed-post",
      status: "trash",
      deleted_at: new Date(),
      author_id: null,
    }),
  );

  const res = await request(app.getHttpServer())
    .post(`/api/posts/${post.id}/restore`)
    .set("Authorization", "Bearer " + otherToken)
    .expect(200);

  expect(res.body.status).toBe("draft");
});
```

#### Tests de View Trashed Post (escenarios #20–#24)

```typescript
// 20. Ver un post en trash por su autor
it("GET /api/posts/:id/trash - owner can view trashed post with deleted_at", async () => {
  const deletedAt = new Date();
  const post = await postRepository.save(
    postRepository.create({
      title: "Trashed Post View",
      content: "Content",
      slug: "trashed-post-view",
      status: "trash",
      deleted_at: deletedAt,
      author_id: authorId,
    }),
  );

  const res = await request(app.getHttpServer())
    .get(`/api/posts/${post.id}/trash`)
    .set("Authorization", "Bearer " + authorToken)
    .expect(200);

  expect(res.body.status).toBe("trash");
  expect(res.body.deleted_at).not.toBeNull();
});

// 21. Ver un post que no está en trash
it("GET /api/posts/:id/trash - returns 404 if post is not in trash", async () => {
  const post = await postRepository.save(
    postRepository.create({
      title: "Draft Post Not Trash",
      content: "Content",
      slug: "draft-not-trash",
      status: "draft",
      author_id: authorId,
    }),
  );

  await request(app.getHttpServer())
    .get(`/api/posts/${post.id}/trash`)
    .set("Authorization", "Bearer " + authorToken)
    .expect(404);
});

// 22. Ver post en trash sin token
it("GET /api/posts/:id/trash - without token returns 401", async () => {
  const post = await postRepository.save(
    postRepository.create({
      title: "Trashed Post No Auth View",
      content: "Content",
      slug: "trashed-no-auth-view",
      status: "trash",
      deleted_at: new Date(),
      author_id: authorId,
    }),
  );

  await request(app.getHttpServer())
    .get(`/api/posts/${post.id}/trash`)
    .expect(401);
});

// 23. Ver post en trash por otro usuario
it("GET /api/posts/:id/trash - other user returns 403", async () => {
  const post = await postRepository.save(
    postRepository.create({
      title: "Author Trashed View",
      content: "Content",
      slug: "author-trashed-view",
      status: "trash",
      deleted_at: new Date(),
      author_id: authorId,
    }),
  );

  await request(app.getHttpServer())
    .get(`/api/posts/${post.id}/trash`)
    .set("Authorization", "Bearer " + otherToken)
    .expect(403);
});

// 24. Ver post en trash inexistente
it("GET /api/posts/:id/trash - non-existent returns 404", async () => {
  await request(app.getHttpServer())
    .get("/api/posts/999999/trash")
    .set("Authorization", "Bearer " + authorToken)
    .expect(404);
});
```

> [!IMPORTANT]
> Ejecutar los tests ahora para confirmar que todos **fallan** (rojo). Solo entonces implementar la lógica.
> ```bash
> npx jest --config test/jest-e2e.json --testPathPattern=posts-delete
> ```

---

### Tarea 2 — Implementar `PostsService.restore()`

**Archivo:** [posts.service.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/posts/posts.service.ts)

Agregar el siguiente método antes de `slugify()`:

```typescript
async restore(id: number, currentUserId: number): Promise<Post> {
  const post = await this.postRepository.findOne({ where: { id } });
  if (!post) {
    throw new NotFoundException(`Post con ID ${id} no encontrado.`);
  }

  if (post.author_id !== null && post.author_id !== currentUserId) {
    throw new ForbiddenException('No tienes permiso para restaurar este post.');
  }

  if (post.status !== 'trash') {
    throw new UnprocessableEntityException(
      'El post no está en trash y no puede ser restaurado.',
    );
  }

  post.status = 'draft';
  post.deleted_at = null;
  return await this.postRepository.save(post);
}
```

**Imports ya presentes** (no requieren cambios): `ForbiddenException`, `NotFoundException`, `UnprocessableEntityException` ya están importados.

---

### Tarea 3 — Implementar `POST /api/posts/:id/restore` en el Controller

**Archivo:** [posts.controller.ts](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/src/posts/posts.controller.ts)

Agregar el endpoint después del handler `findOneTrash`:

```typescript
@Post(':id/restore')
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: 'Restore a trashed post' })
@ApiParam({ name: 'id', type: 'number', description: 'The unique ID of the post' })
@ApiResponse({ status: 200, description: 'Post restored successfully.', type: PostEntity })
@ApiResponse({ status: 401, description: 'Unauthorized.' })
@ApiResponse({ status: 403, description: 'Forbidden — not the post author.' })
@ApiResponse({ status: 404, description: 'Post not found.' })
@ApiResponse({ status: 422, description: 'Post is not in trash.' })
async restore(
  @Param('id', ParseIntPipe) id: number,
  @Req() req: any,
): Promise<PostEntity> {
  return this.postsService.restore(id, req.user.id);
}
```

> [!TIP]
> Este endpoint usa `@Post()` (verbo HTTP POST) porque es una acción, no la creación de un nuevo recurso. Es la convención estándar de WordPress REST API para acciones como `/wp/v2/posts/:id/restore`.

---

### Tarea 4 — Exponer `deleted_at` en `GET /api/posts/:id/trash`

**Problema:** El campo `deleted_at` en la entidad `Post` tiene `@Exclude()`, lo que lo oculta de **todas** las respuestas serializadas via `ClassSerializerInterceptor`.

**Solución:** En el handler `findOneTrash`, retornar el objeto **plano** (plain object) en lugar del objeto de entidad, usando `instanceToPlain` de `class-transformer` con exclusión deshabilitada para ese campo.

**Alternativa más simple:** Usar `{ ...post, deleted_at: post.deleted_at }` para retornar un objeto plano que bypasea el interceptor de serialización. El `ClassSerializerInterceptor` solo excluye propiedades de instancias de clases decoradas; un objeto literal no es afectado.

**Implementación en el controller:**

```typescript
@Get(':id/trash')
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: 'Get a trashed post by ID' })
@ApiParam({ name: 'id', type: 'number', description: 'The unique ID of the post' })
@ApiResponse({ status: 200, description: 'The trashed post.', type: PostEntity })
@ApiResponse({ status: 401, description: 'Unauthorized.' })
@ApiResponse({ status: 403, description: 'Forbidden — not the post author.' })
@ApiResponse({ status: 404, description: 'Post not found or not in trash.' })
async findOneTrash(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
  const post = await this.postsService.findById(id);
  if (!post) {
    throw new NotFoundException(`Post with ID ${id} not found`);
  }

  if (post.status !== 'trash') {
    throw new NotFoundException(`Post with ID ${id} not found`);
  }

  if (!this.postsService.isOwner(post, req.user?.id)) {
    throw new ForbiddenException('You do not have access to this post');
  }

  // Retornar objeto plano para que deleted_at no sea excluido por @Exclude()
  return { ...post };
}
```

> [!NOTE]
> Al retornar `{ ...post }` (spread de la instancia de clase a un objeto literal), el `ClassSerializerInterceptor` no aplica las exclusiones de `class-transformer`, por lo que `deleted_at` aparece en la respuesta.

---

### Tarea 5 — Agregar Swagger formal a `GET /api/posts/:id/trash`

Los decoradores Swagger se agregan en la misma modificación de la Tarea 4 (ver código completo del handler arriba).

---

## Archivos a Modificar

| Archivo | Acción | Descripción |
|---|---|---|
| `test/posts-delete.e2e-spec.ts` | Modificar | Agregar 13 tests E2E nuevos (escenarios #12–#24) |
| `src/posts/posts.service.ts` | Modificar | Agregar método `restore()` |
| `src/posts/posts.controller.ts` | Modificar | Agregar `POST :id/restore`, actualizar `GET :id/trash` con `{ ...post }` y Swagger |

---

## Orden de Ejecución (TDD)

```
1. Agregar los 13 tests a posts-delete.e2e-spec.ts
2. Ejecutar tests → todos nuevos FALLAN (rojo ✅)
3. Implementar PostsService.restore()
4. Implementar POST :id/restore en el controller
5. Modificar GET :id/trash para retornar objeto plano con deleted_at
6. Ejecutar tests → todos PASAN (verde ✅)
7. Ejecutar suite completa para verificar que no hay regresiones
```

---

## Verificación

### Tests automáticos
```bash
# Ejecutar solo los tests de delete/restore
npx jest --config test/jest-e2e.json --testPathPattern=posts-delete

# Ejecutar todos los tests E2E para verificar no hay regresión
npm run test:e2e
```

### Verificación manual
- `POST /api/posts/:id/restore` con un post en trash → `200 OK`, `status: "draft"`.
- `POST /api/posts/:id/restore` con un post en draft → `422 Unprocessable Entity`.
- `GET /api/posts/:id/trash` → respuesta incluye `deleted_at` con fecha no nula.
- `GET /api/posts/:id` (endpoint estándar) → `deleted_at` sigue oculto (no afectado).
