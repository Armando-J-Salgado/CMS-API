import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsInt,
} from "class-validator";

export type PostStatus = "draft" | "publish" | "pending" | "private" | "trash";
export const POST_STATUS_VALUES: PostStatus[] = [
  "draft",
  "publish",
  "pending",
  "private",
  "trash",
];

export class CreatePostDto {
  @ApiProperty({ example: "Mi primer post" })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: "Contenido del post" })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ example: "mi-primer-post" })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    enum: POST_STATUS_VALUES,
    default: "draft",
  })
  @IsOptional()
  @IsIn(POST_STATUS_VALUES)
  status?: PostStatus;

  @ApiPropertyOptional({ example: "Resumen breve", nullable: true })
  @IsOptional()
  @IsString()
  excerpt?: string | null;

  @ApiPropertyOptional({ example: 1, nullable: true })
  @IsOptional()
  @IsInt()
  author_id?: number | null;
}
