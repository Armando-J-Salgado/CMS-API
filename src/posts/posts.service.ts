import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Post } from "./entities/post.entity";
import { GetPostsQueryDto, OrderDirection, PostStatus, OrderBy } from "./dto/get-posts-query.dto";

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async findAll(query: GetPostsQueryDto) {
    const { 
      page = 1, 
      per_page = 10, 
      search, 
      status = PostStatus.PUBLISH, 
      author, 
      orderby = OrderBy.CREATED_AT, 
      order = OrderDirection.DESC 
    } = query;

    const qb = this.postRepository.createQueryBuilder("post");

    qb.where("post.status = :status", { status });

    if (author) {
      qb.andWhere("post.author_id = :author", { author });
    }

    if (search) {
      qb.andWhere("(post.title LIKE :search OR post.content LIKE :search)", { search: `%${search}%` });
    }

    qb.orderBy(`post.${orderby}`, order.toUpperCase() as "ASC" | "DESC");

    const skip = (page - 1) * per_page;
    qb.skip(skip).take(per_page);

    const [items, total] = await qb.getManyAndCount();

    const pages = Math.ceil(total / per_page);

    return {
      data: items,
      meta: {
        total,
        pages,
        current_page: page,
        per_page,
      },
    };
  }
}
