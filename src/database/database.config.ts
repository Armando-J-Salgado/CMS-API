import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { Post } from "../posts/entities/post.entity";

export const databaseConfig: TypeOrmModuleOptions = {
  type: "better-sqlite3",
  database: "database.sqlite",
  entities: [Post],
  synchronize: true, // For development ease in Spec 0, auto-synchronize schema
  logging: false,
};
