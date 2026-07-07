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

describe("Posts Update (e2e)", () => {
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
    // Clean database before each test
    await postRepository.clear();
    await userRepository.clear();

    // Create a fresh author and another user for each test
    const author = await userRepository.save({
      email: "author@update-test.com",
      password_hash: "hash",
      name: "Author",
    });
    authorId = author.id;
    authorToken = jwtService.sign({ sub: author.id, email: author.email });

    const other = await userRepository.save({
      email: "other@update-test.com",
      password_hash: "hash",
      name: "Other",
    });
    otherToken = jwtService.sign({ sub: other.id, email: other.email });
  });

  // ─── Existing tests (logic unchanged, now include JWT) ───────────────────

  it("PATCH /api/posts/:id - should partially update post title", async () => {
    const post = postRepository.create({
      title: "Original Title",
      content: "Original Content",
      slug: "original-title",
      status: "draft",
      author_id: authorId,
    });
    const savedPost = await postRepository.save(post);

    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${savedPost.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .send({ title: "New Title" })
      .expect(200);

    expect(response.body.title).toBe("New Title");
    expect(response.body.content).toBe("Original Content");
    // Slug should also be auto-regenerated since title changed and no slug was sent
    expect(response.body.slug).toBe("new-title");
  });

  it("PUT /api/posts/:id - should fully replace a post", async () => {
    const post = postRepository.create({
      title: "Original Title",
      content: "Original Content",
      slug: "original-title",
      status: "draft",
      author_id: authorId,
    });
    const savedPost = await postRepository.save(post);

    const response = await request(app.getHttpServer())
      .put(`/api/posts/${savedPost.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .send({
        title: "Replaced Title",
        content: "Replaced Content",
        excerpt: "New Excerpt",
        status: "pending",
      })
      .expect(200);

    expect(response.body.title).toBe("Replaced Title");
    expect(response.body.content).toBe("Replaced Content");
    expect(response.body.excerpt).toBe("New Excerpt");
    expect(response.body.status).toBe("pending");
  });

  it("PUT /api/posts/:id - should return 400 if title or content is missing", async () => {
    const post = postRepository.create({
      title: "Original Title",
      content: "Original Content",
      slug: "original-title",
      status: "draft",
      author_id: authorId,
    });
    const savedPost = await postRepository.save(post);

    // Missing content
    await request(app.getHttpServer())
      .put(`/api/posts/${savedPost.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .send({ title: "Only Title" })
      .expect(400);

    // Missing title
    await request(app.getHttpServer())
      .put(`/api/posts/${savedPost.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .send({ content: "Only Content" })
      .expect(400);
  });

  it("PATCH /api/posts/:id - should return 404 if post does not exist", async () => {
    await request(app.getHttpServer())
      .patch("/api/posts/99999")
      .set("Authorization", "Bearer " + authorToken)
      .send({ title: "New Title" })
      .expect(404);
  });

  it("PATCH /api/posts/:id - should block update if post is in trash", async () => {
    const post = postRepository.create({
      title: "Trash Post",
      content: "Trash Content",
      slug: "trash-post",
      status: "trash",
      author_id: authorId,
    });
    const savedPost = await postRepository.save(post);

    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${savedPost.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .send({ title: "Updated Title" })
      .expect(422);

    expect(response.body.message).toBe("Un post en trash no puede ser actualizado directamente. Restáuralo primero.");
  });

  it("PATCH /api/posts/:id - should allow restoring post from trash", async () => {
    const post = postRepository.create({
      title: "Trash Post",
      content: "Trash Content",
      slug: "trash-post",
      status: "trash",
      deleted_at: new Date(),
      author_id: authorId,
    });
    const savedPost = await postRepository.save(post);

    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${savedPost.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .send({ status: "draft" })
      .expect(200);

    expect(response.body.status).toBe("draft");
    expect(response.body).not.toHaveProperty("deleted_at");
  });

  it("PATCH /api/posts/:id - should block transition to publish if title or content is empty", async () => {
    const post = postRepository.create({
      title: "Draft Post",
      content: "",
      slug: "draft-post",
      status: "draft",
      author_id: authorId,
    });
    const savedPost = await postRepository.save(post);

    // Transition with empty content should fail
    await request(app.getHttpServer())
      .patch(`/api/posts/${savedPost.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .send({ status: "publish" })
      .expect(422);
  });

  it("PATCH /api/posts/:id - should set published_at on first publication", async () => {
    const post = postRepository.create({
      title: "Draft Post",
      content: "Fine content",
      slug: "draft-post",
      status: "draft",
      published_at: null,
      author_id: authorId,
    });
    const savedPost = await postRepository.save(post);

    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${savedPost.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .send({ status: "publish" })
      .expect(200);

    expect(response.body.status).toBe("publish");
    expect(response.body.published_at).not.toBeNull();
  });

  it("PATCH /api/posts/:id - should not overwrite published_at if already published", async () => {
    const originalPublishedAt = new Date("2026-01-01T00:00:00.000Z");
    const post = postRepository.create({
      title: "Published Post",
      content: "Fine content",
      slug: "published-post",
      status: "publish",
      published_at: originalPublishedAt,
      author_id: authorId,
    });
    const savedPost = await postRepository.save(post);

    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${savedPost.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .send({ title: "New Title" })
      .expect(200);

    expect(new Date(response.body.published_at).getTime()).toBe(originalPublishedAt.getTime());
  });

  it("PATCH /api/posts/:id - should set deleted_at when moving to trash", async () => {
    const post = postRepository.create({
      title: "Post to Trash",
      content: "Fine content",
      slug: "post-to-trash",
      status: "draft",
      author_id: authorId,
    });
    const savedPost = await postRepository.save(post);

    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${savedPost.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .send({ status: "trash" })
      .expect(200);

    expect(response.body.status).toBe("trash");
    expect(response.body.deleted_at).not.toBeNull();
  });

  it("PATCH /api/posts/:id - should return 422 if slug is already in use", async () => {
    const post1 = await postRepository.save(
      postRepository.create({
        title: "Post One",
        content: "Content",
        slug: "post-one",
        status: "draft",
        author_id: authorId,
      }),
    );

    const post2 = await postRepository.save(
      postRepository.create({
        title: "Post Two",
        content: "Content",
        slug: "post-two",
        status: "draft",
        author_id: authorId,
      }),
    );

    // Try to update post2 to have the same slug as post1
    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${post2.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .send({ slug: "post-one" })
      .expect(422);

    expect(response.body.message).toContain("ya está en uso");
  });

  // ─── New authorization tests ─────────────────────────────────────────────

  it("PATCH /api/posts/:id - sin token devuelve 401", async () => {
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
      .patch(`/api/posts/${post.id}`)
      .send({ title: "Hacked Title" })
      .expect(401);
  });

  it("PUT /api/posts/:id - sin token devuelve 401", async () => {
    const post = await postRepository.save(
      postRepository.create({
        title: "Some Post",
        content: "Content",
        slug: "some-post-put",
        status: "draft",
        author_id: authorId,
      }),
    );

    await request(app.getHttpServer())
      .put(`/api/posts/${post.id}`)
      .send({ title: "Hacked", content: "Hacked" })
      .expect(401);
  });

  it("PATCH /api/posts/:id - actualizar post ajeno devuelve 403", async () => {
    const post = await postRepository.save(
      postRepository.create({
        title: "Author Post",
        content: "Content",
        slug: "author-post-patch",
        status: "draft",
        author_id: authorId,
      }),
    );

    await request(app.getHttpServer())
      .patch(`/api/posts/${post.id}`)
      .set("Authorization", "Bearer " + otherToken)
      .send({ title: "Intruder Title" })
      .expect(403);
  });

  it("PUT /api/posts/:id - actualizar post ajeno devuelve 403", async () => {
    const post = await postRepository.save(
      postRepository.create({
        title: "Author Post",
        content: "Content",
        slug: "author-post-put",
        status: "draft",
        author_id: authorId,
      }),
    );

    await request(app.getHttpServer())
      .put(`/api/posts/${post.id}`)
      .set("Authorization", "Bearer " + otherToken)
      .send({ title: "Intruder", content: "Intruder content" })
      .expect(403);
  });

  it("PATCH /api/posts/:id - post sin author_id (legacy) puede ser actualizado por cualquier usuario autenticado", async () => {
    const post = await postRepository.save(
      postRepository.create({
        title: "Legacy Post",
        content: "Content",
        slug: "legacy-post",
        status: "draft",
        author_id: null,
      }),
    );

    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${post.id}`)
      .set("Authorization", "Bearer " + otherToken)
      .send({ title: "Claimed Title" })
      .expect(200);

    expect(response.body.title).toBe("Claimed Title");
  });

  it("PATCH /api/posts/:id - el autor puede transferir la autoría a otro usuario", async () => {
    const other = await userRepository.findOne({ where: { email: "other@update-test.com" } });

    const post = await postRepository.save(
      postRepository.create({
        title: "Author Post",
        content: "Content",
        slug: "author-transfer-post",
        status: "draft",
        author_id: authorId,
      }),
    );

    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${post.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .send({ author_id: other!.id })
      .expect(200);

    expect(response.body.author_id).toBe(other!.id);
  });

  it("PATCH /api/posts/:id - should block transition from publish to pending", async () => {
    const post = postRepository.create({
      title: "Published Post",
      content: "Content",
      slug: "published-post-to-pending",
      status: "publish",
      published_at: new Date(),
      author_id: authorId,
    });
    const savedPost = await postRepository.save(post);

    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${savedPost.id}`)
      .set("Authorization", "Bearer " + authorToken)
      .send({ status: "pending" })
      .expect(422);

    expect(response.body.message).toBe(
      "Un post publicado no puede regresar a estado pendiente de revisión.",
    );
  });
});
