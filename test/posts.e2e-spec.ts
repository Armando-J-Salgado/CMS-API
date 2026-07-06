import { JwtService } from "@nestjs/jwt";
import { INestApplication, UnprocessableEntityException, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { Post } from "../src/posts/entities/post.entity";
import { User } from "../src/users/entities/user.entity";

describe("PostsController (e2e)", () => {
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
        forbidNonWhitelisted: false,
        exceptionFactory: (errors) => {
          const details: Record<string, string> = {};
          errors.forEach((e) => {
            details[e.property] = Object.values(e.constraints ?? {}).join(", ");
          });
          return new UnprocessableEntityException({
            error: "Unprocessable Entity",
            message: "Validation failed",
            details,
          });
        },
      }),
    );
    await app.init();

    postRepository = moduleFixture.get<Repository<Post>>(getRepositoryToken(Post));
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await userRepository.clear();
    await postRepository.clear();

    const author = await userRepository.save({
      email: "author@example.com",
      password_hash: "hash",
      name: "Author",
    });
    authorId = author.id;
    authorToken = jwtService.sign({ sub: author.id, email: author.email });

    const other = await userRepository.save({
      email: "other@example.com",
      password_hash: "hash",
      name: "Other",
    });
    otherToken = jwtService.sign({ sub: other.id, email: other.email });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await postRepository.clear();
  });

  it("POST /api/posts — crea post exitosamente (201)", () => {
    return request(app.getHttpServer())
      .post("/api/posts")
      .send({ title: "Titulo del Post", content: "Contenido del post" })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.title).toBe("Titulo del Post");
        expect(res.body.content).toBe("Contenido del post");
        expect(res.body.slug).toBe("titulo-del-post");
        expect(res.body.status).toBe("draft");
      });
  });

  it("POST /api/posts — genera slug automatico desde title", () => {
    return request(app.getHttpServer())
      .post("/api/posts")
      .send({ title: "Hola Mundo", content: "x" })
      .expect(201)
      .expect((res) => {
        expect(res.body.slug).toBe("hola-mundo");
      });
  });

  it("POST /api/posts — falta title devuelve 422", () => {
    return request(app.getHttpServer())
      .post("/api/posts")
      .send({ content: "x" })
      .expect(422)
      .expect((res) => {
        expect(res.body.details).toBeDefined();
        expect(res.body.details.title).toBeTruthy();
      });
  });

  it("POST /api/posts — falta content devuelve 422", () => {
    return request(app.getHttpServer())
      .post("/api/posts")
      .send({ title: "x" })
      .expect(422)
      .expect((res) => {
        expect(res.body.details).toBeDefined();
        expect(res.body.details.content).toBeTruthy();
      });
  });

  it("POST /api/posts — status por defecto es draft", () => {
    return request(app.getHttpServer())
      .post("/api/posts")
      .send({ title: "Post sin status", content: "contenido" })
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe("draft");
      });
  });

  it("/api/posts/:id (GET) - Publish (Anonymous)", async () => {
    const post = await postRepository.save({
      title: "Title",
      slug: "slug-pub",
      status: "publish",
      author_id: authorId,
    });
    const response = await request(app.getHttpServer()).get(`/api/posts/${post.id}`);
    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("deleted_at");
  });

  it("/api/posts/:id (GET) - Draft (Author)", async () => {
    const post = await postRepository.save({
      title: "Title",
      slug: "slug-draft-auth",
      status: "draft",
      author_id: authorId,
    });
    const response = await request(app.getHttpServer())
      .get(`/api/posts/${post.id}`)
      .set("Authorization", "Bearer " + authorToken);
    expect(response.status).toBe(200);
  });

  it("/api/posts/:id (GET) - Draft (Other)", async () => {
    const post = await postRepository.save({
      title: "Title",
      slug: "slug-draft-oth",
      status: "draft",
      author_id: authorId,
    });
    const response = await request(app.getHttpServer())
      .get(`/api/posts/${post.id}`)
      .set("Authorization", "Bearer " + otherToken);
    expect(response.status).toBe(403);
  });

  it("/api/posts/:id (GET) - Trash (Returns 404)", async () => {
    const post = await postRepository.save({
      title: "Title",
      slug: "slug-trash",
      status: "trash",
      author_id: authorId,
    });
    const response = await request(app.getHttpServer())
      .get(`/api/posts/${post.id}`)
      .set("Authorization", "Bearer " + authorToken);
    expect(response.status).toBe(404);
  });

  it("/api/posts/:id/trash (GET) - Trash (Author)", async () => {
    const post = await postRepository.save({
      title: "Title",
      slug: "slug-trash-auth",
      status: "trash",
      author_id: authorId,
    });
    const response = await request(app.getHttpServer())
      .get(`/api/posts/${post.id}/trash`)
      .set("Authorization", "Bearer " + authorToken);
    expect(response.status).toBe(200);
  });
});
