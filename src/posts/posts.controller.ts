import {
  Controller,
  Post,
  Patch,
  Put,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiResponse,
} from "@nestjs/swagger";
import { PostsService } from "./posts.service";
import { CreatePostDto } from "./dto/create-post.dto";
import { UpdatePostDto } from "./dto/update-post.dto";
import { ReplacePostDto } from "./dto/replace-post.dto";
import { Post as PostEntity } from "./entities/post.entity";

@ApiTags("posts")
@Controller("posts")
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