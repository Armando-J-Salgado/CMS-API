import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { CreatePostDto } from "./dto/create-post.dto";
import { ReplacePostDto } from "./dto/replace-post.dto";
import { UpdatePostDto } from "./dto/update-post.dto";
import { Post as PostEntity } from "./entities/post.entity";
import { PostsService } from "./posts.service";

@ApiTags("posts")
@Controller("posts")
@UseInterceptors(ClassSerializerInterceptor)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a post" })
  @ApiBody({ type: CreatePostDto })
  @ApiResponse({ status: 201, description: "Post created", type: PostEntity })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 422, description: "Validation error" })
  async create(@Body() dto: CreatePostDto, @Req() req: any): Promise<PostEntity> {
    return this.postsService.create(dto, req.user.id);
  }

  @Get(":id")
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    const post = await this.postsService.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    if (post.status === "trash") {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    if (post.status === "publish") {
      return post;
    }

    if (this.postsService.isOwner(post, req.user?.id)) {
      return post;
    }

    throw new ForbiddenException("You do not have access to this post");
  }

  @Get(":id/trash")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a trashed post by ID' })
  @ApiParam({ name: 'id', type: 'number', description: 'The unique ID of the post' })
  @ApiResponse({ status: 200, description: 'The trashed post.', type: PostEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the post author.' })
  @ApiResponse({ status: 404, description: 'Post not found or not in trash.' })
  async findOneTrash(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    const post = await this.postsService.findById(id);
    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    if (post.status !== "trash") {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    if (!this.postsService.isOwner(post, req.user?.id)) {
      throw new ForbiddenException("You do not have access to this post");
    }

    // Retornar objeto plano para que deleted_at no sea excluido por @Exclude()
    return { ...post };
  }

  @Post(':id/restore')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a trashed post' })
  @ApiParam({ name: 'id', type: 'number', description: 'The unique ID of the post' })
  @ApiResponse({ status: 200, description: 'Post restored successfully.', type: PostEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the post author.' })
  @ApiResponse({ status: 404, description: 'Post not found.' })
  @ApiResponse({ status: 422, description: 'Post is not in trash.' })
  async restore(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ): Promise<PostEntity> {
    return this.postsService.restore(id, req.user.id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Partially update a post by ID" })
  @ApiParam({ name: "id", type: "number", description: "The unique ID of the post" })
  @ApiBody({ type: UpdatePostDto })
  @ApiResponse({ status: 200, description: "The post was successfully updated.", type: PostEntity })
  @ApiResponse({ status: 400, description: "Bad request / validation error." })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden — not the post author." })
  @ApiResponse({ status: 404, description: "Post not found." })
  @ApiResponse({ status: 422, description: "Unprocessable Entity due to business rules." })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
    @Req() req: any,
  ): Promise<PostEntity> {
    return await this.postsService.update(id, dto, req.user.id);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Replace a post by ID" })
  @ApiParam({ name: "id", type: "number", description: "The unique ID of the post" })
  @ApiBody({ type: ReplacePostDto })
  @ApiResponse({ status: 200, description: "The post was successfully replaced.", type: PostEntity })
  @ApiResponse({ status: 400, description: "Bad request / validation error." })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden — not the post author." })
  @ApiResponse({ status: 404, description: "Post not found." })
  @ApiResponse({ status: 422, description: "Unprocessable Entity due to business rules." })
  async replace(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReplacePostDto,
    @Req() req: any,
  ): Promise<PostEntity> {
    return await this.postsService.update(id, dto, req.user.id);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a post (soft-delete or force-delete)" })
  @ApiParam({ name: "id", type: "number", description: "The unique ID of the post" })
  @ApiQuery({ name: "force", required: false, type: "boolean", description: "If true, permanently deletes the post" })
  @ApiResponse({ status: 204, description: "Post deleted successfully." })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden — not the post author." })
  @ApiResponse({ status: 404, description: "Post not found." })
  async delete(
    @Param("id", ParseIntPipe) id: number,
    @Query("force") force: string,
    @Req() req: any,
  ): Promise<void> {
    if (force === "true") {
      return this.postsService.forceDelete(id, req.user.id);
    }
    return this.postsService.softDelete(id, req.user.id);
  }
}
