import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Post } from "./entities/post.entity";
import { CreatePostDto } from "./dto/create-post.dto";
import { BadRequestError } from "../common/errors/app-errors";

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async create(dto: CreatePostDto): Promise<Post> {
    const slug = dto.slug?.trim() ? dto.slug.trim() : this.slugify(dto.title);
    const status = dto.status ?? "draft";
    const published_at = status === "publish" ? new Date() : null;

    try {
      return await this.postRepository.save({
        title: dto.title,
        content: dto.content,
        excerpt: dto.excerpt ?? null,
        author_id: dto.author_id ?? null,
        deleted_at: null,
        slug,
        status,
        published_at,
      });
    } catch (err: any) {
      if (
        typeof err?.message === "string" &&
        err.message.includes("UNIQUE constraint failed: posts.slug")
      ) {
        throw new BadRequestError("A post with this slug already exists");
      }
      throw err;
    }
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
}
