import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, UnprocessableEntityException } from "@nestjs/common";
import * as request from "supertest";
import { DataSource } from "typeorm";
import { AppModule } from "../src/app.module";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";

describe("Posts (e2e)", () => {
  let app: INestApplication;

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

    // Limpiar tabla posts antes de cada suite para evitar colisiones de slug
    const ds = app.get(DataSource);
    await ds.query("DELETE FROM posts");
  });

  afterAll(async () => {
    await app.close();
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
});
