import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { PostsService } from "./posts.service";
import { GetPostsQueryDto } from "./dto/get-posts-query.dto";

@ApiTags("posts")
@Controller("posts")
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @ApiOperation({ summary: "Get all posts" })
  @ApiResponse({ status: 200, description: "Returns paginated list of posts." })
  async findAll(@Query() query: GetPostsQueryDto) {
    return this.postsService.findAll(query);
  }
}
