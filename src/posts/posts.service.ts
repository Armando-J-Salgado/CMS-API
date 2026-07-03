import { Injectable, NotFoundException, UnprocessableEntityException, ForbiddenException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Post } from "./entities/post.entity";
import { UpdatePostDto } from "./dto/update-post.dto";
import { ReplacePostDto } from "./dto/replace-post.dto";

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async update(id: number, dto: UpdatePostDto | ReplacePostDto, currentUserId?: number): Promise<Post> {
    const post = await this.postRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post con ID ${id} no encontrado.`);
    }

    // Bloqueo de trash: un post en trash no puede ser actualizado directamente.
    // Solo se permite si se está restaurando (cambiando status a otro diferente de trash).
    if (post.status === "trash") {
      if (dto.status === undefined || dto.status === "trash") {
        throw new UnprocessableEntityException("Un post en trash no puede ser actualizado directamente. Restáuralo primero.");
      }
    }

    // Validación de Propiedad
    if (currentUserId !== undefined && post.author_id !== null && post.author_id !== currentUserId) {
      throw new ForbiddenException("No tienes permiso para modificar este post.");
    }

    // Determinar valores finales
    const finalStatus = dto.status !== undefined ? dto.status : post.status;
    const finalTitle = dto.title !== undefined ? dto.title : post.title;
    const finalContent = dto.content !== undefined ? dto.content : post.content;

    // Validación de transición a publish: no puede tener título o contenido vacíos
    if (finalStatus === "publish") {
      if (!finalTitle || finalTitle.trim() === "" || !finalContent || finalContent.trim() === "") {
        throw new UnprocessableEntityException("Un post solo se puede pasar a 'publish' si el título y el contenido no están vacíos.");
      }
    }

    // Auto-generación de slug o asignación
    const slugToCheck = dto.slug !== undefined ? dto.slug : (dto.title !== undefined ? this.slugify(dto.title) : undefined);
    if (slugToCheck !== undefined) {
      const existingWithSlug = await this.postRepository.findOne({ where: { slug: slugToCheck } });
      if (existingWithSlug && existingWithSlug.id !== id) {
        throw new UnprocessableEntityException(`El slug '${slugToCheck}' ya está en uso.`);
      }
      post.slug = slugToCheck;
    }

    // Manejo de campos de ciclo de vida:
    // 1. Al entrar a publish por primera vez
    if (finalStatus === "publish" && post.published_at === null) {
      post.published_at = new Date();
    }

    // 2. Al entrar a trash
    if (finalStatus === "trash" && post.status !== "trash") {
      post.deleted_at = new Date();
    }

    // 3. Al salir de trash
    if (post.status === "trash" && finalStatus !== "trash") {
      post.deleted_at = null;
    }

    // Actualización de campos
    if (dto.title !== undefined) post.title = dto.title;
    if (dto.content !== undefined) post.content = dto.content;
    if (dto.excerpt !== undefined) post.excerpt = dto.excerpt;
    if (dto.status !== undefined) post.status = dto.status;
    if (dto.author_id !== undefined) post.author_id = dto.author_id;

    return await this.postRepository.save(post);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}

