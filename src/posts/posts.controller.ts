import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
} from "@nestjs/swagger";
import { PostsService } from "./posts.service";
import { CreatePostDto } from "./dto/create-post.dto";
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
}
