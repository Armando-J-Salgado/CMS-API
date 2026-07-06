import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { databaseConfig } from "./database/database.config";
import { PostsModule } from "./posts/posts.module";
import { HealthController } from "./controllers/health.controller";
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    PostsModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
