import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Post } from "../src/posts/entities/post.entity";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";

describe("Posts Update (e2e)", () => {
  let app: INestApplication;
  let postRepository: Repository<Post>;

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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await postRepository.clear();
  });

  it("PATCH /api/posts/:id - should partially update post title", async () => {
    const post = postRepository.create({
      title: "Original Title",
      content: "Original Content",
      slug: "original-title",
      status: "draft",
      author_id: 1,
    });
    const savedPost = await postRepository.save(post);

    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${savedPost.id}`)
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
      author_id: 1,
    });
    const savedPost = await postRepository.save(post);

    const response = await request(app.getHttpServer())
      .put(`/api/posts/${savedPost.id}`)
      .send({
        title: "Replaced Title",
        content: "Replaced Content",
        excerpt: "New Excerpt",
        status: "pending",
        author_id: 2,
      })
      .expect(200);

    expect(response.body.title).toBe("Replaced Title");
    expect(response.body.content).toBe("Replaced Content");
    expect(response.body.excerpt).toBe("New Excerpt");
    expect(response.body.status).toBe("pending");
    expect(response.body.author_id).toBe(2);
  });

  it("PUT /api/posts/:id - should return 400 if title or content is missing", async () => {
    const post = postRepository.create({
      title: "Original Title",
      content: "Original Content",
      slug: "original-title",
      status: "draft",
    });
    const savedPost = await postRepository.save(post);

    // Missing content
    await request(app.getHttpServer())
      .put(`/api/posts/${savedPost.id}`)
      .send({ title: "Only Title" })
      .expect(400);

    // Missing title
    await request(app.getHttpServer())
      .put(`/api/posts/${savedPost.id}`)
      .send({ content: "Only Content" })
      .expect(400);
  });

  it("PATCH /api/posts/:id - should return 404 if post does not exist", async () => {
    await request(app.getHttpServer())
      .patch("/api/posts/99999")
      .send({ title: "New Title" })
      .expect(404);
  });

  it("PATCH /api/posts/:id - should block update if post is in trash", async () => {
    const post = postRepository.create({
      title: "Trash Post",
      content: "Trash Content",
      slug: "trash-post",
      status: "trash",
    });
    const savedPost = await postRepository.save(post);

    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${savedPost.id}`)
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
    });
    const savedPost = await postRepository.save(post);

    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${savedPost.id}`)
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
    });
    const savedPost = await postRepository.save(post);

    // Transition with empty content should fail
    await request(app.getHttpServer())
      .patch(`/api/posts/${savedPost.id}`)
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
    });
    const savedPost = await postRepository.save(post);

    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${savedPost.id}`)
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
    });
    const savedPost = await postRepository.save(post);

    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${savedPost.id}`)
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
    });
    const savedPost = await postRepository.save(post);

    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${savedPost.id}`)
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
      }),
    );

    const post2 = await postRepository.save(
      postRepository.create({
        title: "Post Two",
        content: "Content",
        slug: "post-two",
        status: "draft",
      }),
    );

    // Try to update post2 to have the same slug as post1
    const response = await request(app.getHttpServer())
      .patch(`/api/posts/${post2.id}`)
      .send({ slug: "post-one" })
      .expect(422);

    expect(response.body.message).toContain("ya está en uso");
  });
});
