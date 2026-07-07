import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BadRequestError } from "../common/errors/app-errors";
import { CreatePostDto } from "./dto/create-post.dto";
import { ReplacePostDto } from "./dto/replace-post.dto";
import { UpdatePostDto } from "./dto/update-post.dto";
import { Post } from "./entities/post.entity";
import { GetPostsQueryDto, OrderDirection, PostStatus, OrderBy } from "./dto/get-posts-query.dto";

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async create(dto: CreatePostDto, userId: number): Promise<Post> {
    const slug = dto.slug?.trim() ? dto.slug.trim() : this.slugify(dto.title);
    const status = dto.status ?? "draft";
    const published_at = status === "publish" ? new Date() : null;

    try {
      return await this.postRepository.save({
        title: dto.title,
        content: dto.content,
        excerpt: dto.excerpt ?? null,
        author_id: userId,
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

  async findById(id: number): Promise<Post | null> {
    return this.postRepository.findOne({ where: { id } });
  }

  isOwner(post: Post, userId?: number): boolean {
    if (!userId) return false;
    return post.author_id === userId;
  }

  async update(
    id: number,
    dto: UpdatePostDto | ReplacePostDto,
    currentUserId: number,
  ): Promise<Post> {
    const post = await this.postRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post con ID ${id} no encontrado.`);
    }

    if (post.status === "trash") {
      if (dto.status === undefined || dto.status === "trash") {
        throw new UnprocessableEntityException(
          "Un post en trash no puede ser actualizado directamente. Restáuralo primero.",
        );
      }
    }

    if (post.author_id !== null && post.author_id !== currentUserId) {
      throw new ForbiddenException("No tienes permiso para modificar este post.");
    }

    const finalStatus = dto.status !== undefined ? dto.status : post.status;
    const finalTitle = dto.title !== undefined ? dto.title : post.title;
    const finalContent = dto.content !== undefined ? dto.content : post.content;

    if (post.status === "publish" && finalStatus === "pending") {
      throw new UnprocessableEntityException(
        "Un post publicado no puede regresar a estado pendiente de revisión.",
      );
    }

    if (finalStatus === "publish") {
      if (
        !finalTitle ||
        finalTitle.trim() === "" ||
        !finalContent ||
        finalContent.trim() === ""
      ) {
        throw new UnprocessableEntityException(
          "Un post solo se puede pasar a 'publish' si el título y el contenido no están vacíos.",
        );
      }
    }

    const slugToCheck =
      dto.slug !== undefined
        ? dto.slug
        : dto.title !== undefined
          ? this.slugify(dto.title)
          : undefined;
    if (slugToCheck !== undefined) {
      const existingWithSlug = await this.postRepository.findOne({
        where: { slug: slugToCheck },
      });
      if (existingWithSlug && existingWithSlug.id !== id) {
        throw new UnprocessableEntityException(
          `El slug '${slugToCheck}' ya está en uso.`,
        );
      }
      post.slug = slugToCheck;
    }

    if (finalStatus === "publish" && post.published_at === null) {
      post.published_at = new Date();
    }

    if (finalStatus === "trash" && post.status !== "trash") {
      post.deleted_at = new Date();
    }

    if (post.status === "trash" && finalStatus !== "trash") {
      post.deleted_at = null;
    }

    if (dto.title !== undefined) post.title = dto.title;
    if (dto.content !== undefined) post.content = dto.content;
    if (dto.excerpt !== undefined) post.excerpt = dto.excerpt;
    if (dto.status !== undefined) post.status = dto.status;
    if (dto.author_id !== undefined) post.author_id = dto.author_id;

    return await this.postRepository.save(post);
  }

  async softDelete(id: number, currentUserId: number): Promise<void> {
    const post = await this.postRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post con ID ${id} no encontrado.`);
    }

    if (post.author_id !== null && post.author_id !== currentUserId) {
      throw new ForbiddenException("No tienes permiso para eliminar este post.");
    }

    if (post.status === "trash") {
      return;
    }

    post.status = "trash";
    post.deleted_at = new Date();
    await this.postRepository.save(post);
  }

  async forceDelete(id: number, currentUserId: number): Promise<void> {
    const post = await this.postRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post con ID ${id} no encontrado.`);
    }

    if (post.author_id !== null && post.author_id !== currentUserId) {
      throw new ForbiddenException("No tienes permiso para eliminar este post.");
    }

    await this.postRepository.remove(post);
  }

  async restore(id: number, currentUserId: number): Promise<Post> {
    const post = await this.postRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post con ID ${id} no encontrado.`);
    }

    if (post.author_id !== null && post.author_id !== currentUserId) {
      throw new ForbiddenException('No tienes permiso para restaurar este post.');
    }

    if (post.status !== 'trash') {
      throw new UnprocessableEntityException(
        'El post no está en trash y no puede ser restaurado.',
      );
    }

    post.status = 'draft';
    post.deleted_at = null;
    return await this.postRepository.save(post);
  }

  private slugify(text: string): string {
    const source = text.toLowerCase().trim();
    let slug = "";
    let previousWasSeparator = false;

    for (const char of source) {
      const code = char.charCodeAt(0);
      const isLetter = code >= 97 && code <= 122;
      const isDigit = code >= 48 && code <= 57;
      const isSeparator =
        char === " " ||
        char === "\t" ||
        char === "\n" ||
        char === "\r" ||
        char === "\f" ||
        char === "\v" ||
        char === "_" ||
        char === "-";

      if (isLetter || isDigit) {
        slug += char;
        previousWasSeparator = false;
        continue;
      }

      if (isSeparator && !previousWasSeparator && slug.length > 0) {
        slug += "-";
        previousWasSeparator = true;
      }
    }

    if (slug.endsWith("-")) {
      return slug.slice(0, -1);
    }

    return slug;
  }

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
