import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("posts")
export class Post {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text", nullable: true })
  content!: string | null;

  @Column({ type: "text", nullable: true })
  excerpt!: string | null;

  @Column({ type: "varchar", length: 255, unique: true })
  slug!: string;

  @Column({
    type: "varchar",
    length: 20,
    default: "draft"
  })
  status!: "draft" | "publish" | "pending" | "private" | "trash";

  @Column({ type: "integer", nullable: true })
  author_id!: number | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ type: "datetime", nullable: true })
  published_at!: Date | null;

  @Column({ type: "datetime", nullable: true })
  deleted_at!: Date | null;
}
