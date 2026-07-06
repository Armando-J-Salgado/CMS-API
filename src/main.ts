import { ValidationPipe, UnprocessableEntityException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ValidationPipe, BadRequestException } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      exceptionFactory: (errors) => {
        const details: Record<string, string> = {};
        errors.forEach((e) => {
          if (e.constraints) {
            details[e.property] = Object.values(e.constraints).join(", ");
          }
        });
        return new UnprocessableEntityException({
          error: "Unprocessable Entity",
          message: "Validation failed",
          details,
        });
      },
    }),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle("CMS API")
    .setDescription("CMS API built with NestJS, TypeORM, and SQLite")
    .setVersion("1.0")
    .addTag("posts")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(3000);
}
bootstrap();
