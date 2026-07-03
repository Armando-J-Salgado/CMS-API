# Spec 0: Foundation

This document defines the architectural foundation for the CMS API, specifying the folder structure, database schema, data models, error handling standards, and health check validation.

---

## 1. Architectural Design & Folder Structure

The project will use **NestJS** for the API framework, **TypeORM** for database operations, and **better-sqlite3** as the SQLite database driver.

To ensure modularity and scalability, the project follows NestJS's modular architectural pattern.

### Folder Structure
```text
CMS-API/
├── doc/
│   └── ai/
│       └── specs/
│           └── spec0.md            # This specification
├── src/
│   ├── app.module.ts               # Root module
│   ├── main.ts                     # Entry point of the application (includes Swagger config)
│   ├── database/
│   │   └── database.config.ts      # TypeORM configuration with SQLite/better-sqlite3
│   ├── common/
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts # Global NestJS exception filter for standard errors
│   │   └── errors/
│   │       └── app-errors.ts       # Custom base error classes
│   └── posts/
│       ├── posts.module.ts         # Posts module
│       ├── posts.controller.ts     # Posts controller (endpoints placeholder)
│       ├── posts.service.ts        # Posts service (business logic placeholder)
│       └── entities/
│           └── post.entity.ts      # TypeORM Post Entity
├── test/
│   ├── health.e2e-spec.ts          # E2E health check verification test
│   └── jest-e2e.json               # E2E test configuration
├── nest-cli.json                   # NestJS CLI configuration
├── package.json
├── tsconfig.json
└── README.md
```

---

## 2. Database Schema (Post Model)

The database will contain a `posts` table managed via TypeORM.

### TypeORM Entity: `src/posts/entities/post.entity.ts`
```typescript
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
```

### Constraints & Lifecycle Field Rules:
1. **Slug**: Unique, auto-generated from `title` if not explicitly supplied.
2. **Published Date (`published_at`)**:
   - Set to current timestamp when the post status transitions to `publish` for the first time.
   - Retained on subsequent updates unless specified otherwise.
3. **Deleted Date (`deleted_at`)**:
   - Set to current timestamp when status transitions to `trash`.
   - Cleared (set to `null`) when status changes from `trash` to another state (restoration).

---

## 3. Simplified Error Response Format

Errors must return a consistent JSON payload with an appropriate HTTP status code. In NestJS, this is implemented using a global exception filter.

### Error Schema
```json
{
  "error": "string",
  "message": "string",
  "details": {}
}
```

- `error`: High-level error type or HTTP status code text (e.g. `"Bad Request"`, `"Not Found"`, `"Internal Server Error"`).
- `message`: User-friendly explanation of what went wrong.
- `details`: (Optional) Object containing validation details or specific field errors.

### Example: Validation Error (400 Bad Request)
```json
{
  "error": "Bad Request",
  "message": "Validation failed",
  "details": {
    "status": "status must be one of draft, publish, pending, private, trash"
  }
}
```

---

## 4. Swagger Integration

A local Swagger UI will be configured in `src/main.ts` using `@nestjs/swagger` and served under `/api/docs`.
Swagger documentation will be auto-generated from controllers and DTOs using standard NestJS decorators.

---

## 5. Acceptance Criteria

### Health Check Endpoint
- **Route**: `GET /api/health` (or `/health` bound inside NestJS app controller under `/api` prefix)
- **Response**: `200 OK`
  ```json
  {
    "status": "ok",
    "database": "connected"
  }
  ```

### Verification Test
NestJS E2E test runner (Jest) will execute a test file `test/health.e2e-spec.ts` to query `/api/health` and verify the status is `200` with the expected JSON payload.
