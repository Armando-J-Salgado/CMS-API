import {
  Body,
  ClassSerializerInterceptor,
  Controller,
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
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBody,
  ApiOperation,
  ApiParam,
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
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a post" })
  @ApiBody({ type: CreatePostDto })
  @ApiResponse({ status: 201, description: "Post created", type: PostEntity })
  @ApiResponse({ status: 422, description: "Validation error" })
  async create(@Body() dto: CreatePostDto): Promise<PostEntity> {
    return this.postsService.create(dto);
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

    return post;
  }

  @Patch(":id")
  @ApiOperation({ summary: "Partially update a post by ID" })
  @ApiParam({ name: "id", type: "number", description: "The unique ID of the post" })
  @ApiBody({ type: UpdatePostDto })
  @ApiResponse({ status: 200, description: "The post was successfully updated.", type: PostEntity })
  @ApiResponse({ status: 400, description: "Bad request / validation error." })
  @ApiResponse({ status: 404, description: "Post not found." })
  @ApiResponse({ status: 422, description: "Unprocessable Entity due to business rules." })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ): Promise<PostEntity> {
    return await this.postsService.update(id, dto);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace a post by ID" })
  @ApiParam({ name: "id", type: "number", description: "The unique ID of the post" })
  @ApiBody({ type: ReplacePostDto })
  @ApiResponse({ status: 200, description: "The post was successfully replaced.", type: PostEntity })
  @ApiResponse({ status: 400, description: "Bad request / validation error." })
  @ApiResponse({ status: 404, description: "Post not found." })
  @ApiResponse({ status: 422, description: "Unprocessable Entity due to business rules." })
  async replace(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReplacePostDto,
  ): Promise<PostEntity> {
    return await this.postsService.update(id, dto);
  }
}
