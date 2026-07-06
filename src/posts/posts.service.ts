import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Post } from "./entities/post.entity";

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}
  
  async findById(id: number): Promise<Post | null> {
    return this.postRepository.findOne({ where: { id } });
  }

  isOwner(post: Post, userId?: number): boolean {
    if (!userId) return false;
    return post.author_id === userId;
  }
}
