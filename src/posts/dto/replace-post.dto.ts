import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsInt, IsIn } from "class-validator";

export class ReplacePostDto {
  @ApiProperty({
    description: "The title of the post",
    example: "My New Title",
  })
  @IsNotEmpty()
  @IsString()
  title!: string;

  @ApiProperty({
    description: "The main content of the post",
    example: "This is the full content of the post.",
  })
  @IsNotEmpty()
  @IsString()
  content!: string;

  @ApiPropertyOptional({
    description: "A short summary of the post",
    example: "Summary of the post.",
  })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional({
    description: "A unique URL-friendly string derived from the title",
    example: "my-new-title",
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
