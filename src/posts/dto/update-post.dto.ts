import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsInt, IsIn } from "class-validator";

export class UpdatePostDto {
  @ApiPropertyOptional({
    description: "The title of the post",
    example: "My Updated Title",
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: "The main content of the post",
    example: "This is the updated content.",
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: "A short summary of the post",
    example: "Updated summary of the post.",
  })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional({
    description: "A unique URL-friendly string derived from the title",
    example: "my-updated-title",
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: "The publication status of the post",
    enum: ["draft", "publish", "pending", "private", "trash"],
    example: "publish",
  })
  @IsOptional()
  @IsIn(["draft", "publish", "pending", "private", "trash"])
  status?: "draft" | "publish" | "pending" | "private" | "trash";

  @ApiPropertyOptional({
    description: "The ID of the author who wrote the post",
    example: 1,
  })
  @IsOptional()
  @IsInt()
  author_id?: number;
}
