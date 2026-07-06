import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Post } from "../src/posts/entities/post.entity";
import { User } from "../src/users/entities/user.entity";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { JwtService } from "@nestjs/jwt";

describe("Posts Delete (e2e)", () => {
  let app: INestApplication;
  let postRepository: Repository<Post>;
  let userRepository: Repository<User>;
  let jwtService: JwtService;

  let authorToken: string;
  let otherToken: string;
  let authorId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    postRepository = moduleFixture.get<Repository<Post>>(getRepositoryToken(Post));
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await postRepository.clear();
    await userRepository.clear();

    const author = await userRepository.save({
      email: "author@delete-test.com",
      password_hash: "hash",
      name: "Author",
    });
    authorId = author.id;
    authorToken = jwtService.sign({ sub: author.id, email: author.email });

    const other = await userRepository.save({
      email: "other@delete-test.com",
      password_hash: "hash",
      name: "Other",
    });
    otherToken = jwtService.sign({ sub: other.id, email: other.email });
  });

  // 1. Soft-delete de un post en draft
  it("DELETE /api/posts/:id - soft-delete on draft post", async () => {
    const post = await postRepository.save(
      postRepository.create({
        title: "Draft Post",
        content: "Content",
        slug: "draft-post",
        status: "draft",
        author_id: authorId,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .expect(204);

    const updated = await postRepository.findOne({ where: { id: post.id } });
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("trash");
    expect(updated!.deleted_at).not.toBeNull();
  });

  // 2. Soft-delete de un post en publish
  it("DELETE /api/posts/:id - soft-delete on publish post", async () => {
    const post = await postRepository.save(
      postRepository.create({
        title: "Publish Post",
        content: "Content",
        slug: "publish-post",
        status: "publish",
        author_id: authorId,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .expect(204);

    const updated = await postRepository.findOne({ where: { id: post.id } });
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("trash");
    expect(updated!.deleted_at).not.toBeNull();
  });

  // 3. Soft-delete de un post que ya está en trash (idempotencia)
  it("DELETE /api/posts/:id - soft-delete on post already in trash is idempotent", async () => {
    const originalDeletedAt = new Date("2026-01-01T00:00:00.000Z");
    const post = await postRepository.save(
      postRepository.create({
        title: "Trash Post",
        content: "Content",
        slug: "trash-post",
        status: "trash",
        deleted_at: originalDeletedAt,
        author_id: authorId,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .expect(204);

    const updated = await postRepository.findOne({ where: { id: post.id } });
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("trash");
    expect(new Date(updated!.deleted_at!).getTime()).toBe(originalDeletedAt.getTime());
  });

  // 4. Force-delete de un post
  it("DELETE /api/posts/:id?force=true - force-delete on draft post", async () => {
    const post = await postRepository.save(
      postRepository.create({
        title: "Draft Post to Force Delete",
        content: "Content",
        slug: "draft-force",
        status: "draft",
        author_id: authorId,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}`)
      .query({ force: "true" })
      .set("Authorization", "Bearer " + authorToken)
      .expect(204);

    const deleted = await postRepository.findOne({ where: { id: post.id } });
    expect(deleted).toBeNull();
  });

  // 5. Force-delete de un post en trash
  it("DELETE /api/posts/:id?force=true - force-delete on trash post", async () => {
    const post = await postRepository.save(
      postRepository.create({
        title: "Trash Post to Force Delete",
        content: "Content",
        slug: "trash-force",
        status: "trash",
        author_id: authorId,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}`)
      .query({ force: "true" })
      .set("Authorization", "Bearer " + authorToken)
      .expect(204);

    const deleted = await postRepository.findOne({ where: { id: post.id } });
    expect(deleted).toBeNull();
  });

  // 6. Delete sin token
  it("DELETE /api/posts/:id - without token returns 401", async () => {
    const post = await postRepository.save(
      postRepository.create({
        title: "Some Post",
        content: "Content",
        slug: "some-post",
        status: "draft",
        author_id: authorId,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}`)
      .expect(401);
  });

  // 7. Delete de post ajeno
  it("DELETE /api/posts/:id - other user post returns 403", async () => {
    const post = await postRepository.save(
      postRepository.create({
        title: "Author Post",
        content: "Content",
        slug: "author-post",
        status: "draft",
        author_id: authorId,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}`)
      .set("Authorization", "Bearer " + otherToken)
      .expect(403);
  });

  // 8. Force-delete de post ajeno
  it("DELETE /api/posts/:id?force=true - other user force delete returns 403", async () => {
    const post = await postRepository.save(
      postRepository.create({
        title: "Author Post",
        content: "Content",
        slug: "author-post-force",
        status: "draft",
        author_id: authorId,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}`)
      .query({ force: "true" })
      .set("Authorization", "Bearer " + otherToken)
      .expect(403);
  });

  // 9. Delete de post inexistente
  it("DELETE /api/posts/:id - non-existent returns 404", async () => {
    await request(app.getHttpServer())
      .delete("/api/posts/999999")
      .set("Authorization", "Bearer " + authorToken)
      .expect(404);
  });

  // 10. Delete de post legacy (author_id = null)
  it("DELETE /api/posts/:id - legacy post soft delete allowed for any authenticated user", async () => {
    const post = await postRepository.save(
      postRepository.create({
        title: "Legacy Post",
        content: "Content",
        slug: "legacy-post",
        status: "draft",
        author_id: null,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}`)
      .set("Authorization", "Bearer " + otherToken)
      .expect(204);

    const updated = await postRepository.findOne({ where: { id: post.id } });
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("trash");
  });

  // 11. Force-delete de post legacy (author_id = null)
  it("DELETE /api/posts/:id?force=true - legacy post force delete allowed for any authenticated user", async () => {
    const post = await postRepository.save(
      postRepository.create({
        title: "Legacy Post Force",
        content: "Content",
        slug: "legacy-post-force",
        status: "draft",
        author_id: null,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/posts/${post.id}`)
      .query({ force: "true" })
      .set("Authorization", "Bearer " + otherToken)
      .expect(204);

    const deleted = await postRepository.findOne({ where: { id: post.id } });
    expect(deleted).toBeNull();
  });

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
});
