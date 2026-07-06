import { Controller, Get, Param, ParseIntPipe, UseGuards, Req, NotFoundException, ForbiddenException, UseInterceptors, ClassSerializerInterceptor } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PostsService } from "./posts.service";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("posts")
@Controller("posts")
@UseInterceptors(ClassSerializerInterceptor)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

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
}
