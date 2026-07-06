import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { databaseConfig } from "./database/database.config";
import { PostsModule } from "./posts/posts.module";
import { HealthController } from "./controllers/health.controller";

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    PostsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
