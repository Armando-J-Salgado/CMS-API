import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ValidationPipe, BadRequestException } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.useGlobalFilters(new HttpExceptionFilter());
  
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const details: Record<string, string> = {};
        errors.forEach((err) => {
          if (err.constraints) {
            details[err.property] = Object.values(err.constraints)[0];
          }
        });
        return new BadRequestException({
          error: "Bad Request",
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
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(3000);
}
bootstrap();
