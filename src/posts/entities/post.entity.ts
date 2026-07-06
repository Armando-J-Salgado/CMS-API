import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Exclude } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

@Entity("posts")
export class Post {
  @ApiProperty({ example: 1, description: 'The unique ID of the post' })
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({ example: 'My First Post', description: 'The title of the post' })
  @Column({ type: "varchar", length: 255 })
  title!: string;

  @ApiProperty({ example: 'This is the content of my first post.', description: 'The content of the post' })
  @Column({ type: "text", nullable: true })
  content!: string | null;

  @ApiProperty({ example: 'A brief summary of the post.', description: 'A short excerpt of the post content' })
  @Column({ type: "text", nullable: true })
  excerpt!: string | null;

  @ApiProperty({ example: 'my-first-post', description: 'The URL-friendly slug of the post' })
  @Column({ type: "varchar", length: 255, unique: true })
  slug!: string;

  @ApiProperty({ example: 'publish', description: 'The current status of the post', enum: ['draft', 'publish', 'pending', 'private', 'trash'] })
  @Column({
    type: "varchar",
    length: 20,
    default: "draft"
  })
  status!: "draft" | "publish" | "pending" | "private" | "trash";

  @ApiProperty({ example: 42, description: 'The ID of the author' })
  @Column({ type: "integer", nullable: true })
  author_id!: number | null;

  @ApiProperty({ example: '2026-07-06T12:00:00Z', description: 'When the post was created' })
  @CreateDateColumn()
  created_at!: Date;

  @ApiProperty({ example: '2026-07-06T15:30:00Z', description: 'When the post was last updated' })
  @UpdateDateColumn()
  updated_at!: Date;

  @ApiProperty({ example: '2026-07-06T13:00:00Z', description: 'When the post was published' })
  @Column({ type: "datetime", nullable: true })
  published_at!: Date | null;

  @Column({ type: "datetime", nullable: true })
  @Exclude()
  deleted_at!: Date | null;
}
