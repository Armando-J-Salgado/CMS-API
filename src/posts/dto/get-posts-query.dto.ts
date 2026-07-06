import { IsOptional, IsInt, Min, Max, IsEnum, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum PostStatus {
  DRAFT = 'draft',
  PUBLISH = 'publish',
  PENDING = 'pending',
  PRIVATE = 'private',
  TRASH = 'trash',
}

export enum OrderBy {
  CREATED_AT = 'created_at',
  UPDATED_AT = 'updated_at',
  TITLE = 'title',
  ID = 'id',
}

export enum OrderDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export class GetPostsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number = 10;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: PostStatus, default: PostStatus.PUBLISH })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus = PostStatus.PUBLISH;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  author?: number;

  @ApiPropertyOptional({ enum: OrderBy, default: OrderBy.CREATED_AT })
  @IsOptional()
  @IsEnum(OrderBy)
  orderby?: OrderBy = OrderBy.CREATED_AT;

  @ApiPropertyOptional({ enum: OrderDirection, default: OrderDirection.DESC })
  @IsOptional()
  @IsEnum(OrderDirection)
  order?: OrderDirection = OrderDirection.DESC;
}
