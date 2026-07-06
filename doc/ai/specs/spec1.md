# Spec 1: Index — GET /posts

This document defines the architectural specifications, request parameters, data validation rules, expected response format, and Test-Driven Development (TDD) acceptance criteria for the Post Index endpoint (`GET /posts`).

---

## 1. Endpoint Contract

- **Method:** `GET`
- **Path:** `/posts` (Served under the global `/api` prefix: `/api/posts`)
- **Description:** Retrieves a paginated list of posts. Supports pagination, full-text searching, status filtering, author filtering, and sorting.

---

## 2. Request Parameters & Validation Rules

All incoming query parameters must be transformed and validated using NestJS Data Transfer Objects (`DTO`) alongside `class-validator` and `class-transformer`. Any violation of these rules must immediately throw a `400 Bad Request` adhering to the standard error structure defined in **Spec 0**.

| Parameter  | Type    | Default      | Validation Rule                                                                    |
| :--------- | :------ | :----------- | :--------------------------------------------------------------------------------- |
| `page`     | integer | `1`          | Must be a positive integer (min: 1).                                               |
| `per_page` | integer | `10`         | Must be a positive integer (min: 1, max: 100).                                     |
| `search`   | string  | `undefined`  | Optional. Max length 100 characters.                                               |
| `status`   | string  | `publish`    | Optional. Must be a valid enum: `draft`, `publish`, `pending`, `private`, `trash`. |
| `author`   | integer | `undefined`  | Optional. Must be a positive integer.                                              |
| `orderby`  | string  | `created_at` | Optional. Must be: `created_at`, `updated_at`, `title`, or `id`.                   |
| `order`    | string  | `desc`       | Optional. Must be lowercase `asc` or `desc`.                                       |

### 2.1 Validation Implementation (`GetPostsQueryDto`)

To enforce these requirements, the following DTO must be implemented in `src/posts/dto/get-posts-query.dto.ts`.

```typescript
import { IsOptional, IsInt, Min, Max, IsEnum, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number = 10;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus = PostStatus.PUBLISH;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  author?: number;

  @IsOptional()
  @IsEnum(OrderBy)
  orderby?: OrderBy = OrderBy.CREATED_AT;

  @IsOptional()
  @IsEnum(OrderDirection)
  order?: OrderDirection = OrderDirection.DESC;
}
{
  "data": [
    {
      "id": 1,
      "title": "API para un CMS de posts",
      "content": "Construyendo una API CRUD inspirada en WordPress.",
      "excerpt": "Construyendo una API...",
      "slug": "api-para-un-cms-de-posts",
      "status": "publish",
      "author_id": 1,
      "created_at": "2026-07-03T11:00:00.000Z",
      "updated_at": "2026-07-03T11:00:00.000Z",
      "published_at": "2026-07-03T11:00:00.000Z",
      "deleted_at": null
    }
  ],
  "meta": {
    "total": 1,
    "pages": 1,
    "current_page": 1,
    "per_page": 10
  }
}
```

## 3. Test Cases & Matrix: Index — GET /posts

This document outlines the End-to-End (E2E) test cases for the Post Index endpoint (`GET /api/posts`). It covers both the expected "Happy Paths" and the "Sad Paths" to verify the system's robustness when handling invalid, incomplete, or malicious data.

### 3.1 Test Environment Setup

- **Database State:** The testing database should be seeded with a minimum of 15 posts covering a mix of statuses (`publish`, `draft`, `trash`), multiple authors, and varying creation dates to properly test pagination, filtering, and sorting.
- **Base URL:** `/api/posts`

---

### 3.2 Test Matrix

| Test ID   | Category   | Description                             | Query Parameters                  | Expected Status   | Expected Behavior / Assertion                                                                      |
| :-------- | :--------- | :-------------------------------------- | :-------------------------------- | :---------------- | :------------------------------------------------------------------------------------------------- |
| **TC-01** | Happy Path | Default listing (no params)             | _(None)_                          | `200 OK`          | Returns max 10 `publish` posts, ordered by `created_at` DESC. Pagination `meta` reflects defaults. |
| **TC-02** | Happy Path | Valid custom pagination                 | `?page=2&per_page=5`              | `200 OK`          | Returns items 6-10. `meta.current_page` is 2, `meta.per_page` is 5.                                |
| **TC-03** | Happy Path | Filter by valid status                  | `?status=draft`                   | `200 OK`          | Returns only items where `status === 'draft'`.                                                     |
| **TC-04** | Happy Path | Filter by valid author                  | `?author=2`                       | `200 OK`          | Returns only items where `author_id === 2`.                                                        |
| **TC-05** | Happy Path | Valid text search                       | `?search=NestJS`                  | `200 OK`          | Returns items containing "NestJS" in `title` or `content` (case-insensitive).                      |
| **TC-06** | Happy Path | Valid custom sorting                    | `?orderby=title&order=asc`        | `200 OK`          | Returns items sorted alphabetically A-Z by `title`.                                                |
| **TC-07** | Happy Path | Combined valid parameters               | `?status=publish&author=1&page=1` | `200 OK`          | Returns only published posts by author 1 on page 1.                                                |
| **TC-08** | Sad Path   | Negative page number                    | `?page=-1`                        | `400 Bad Request` | Error details state: `page must not be less than 1`.                                               |
| **TC-09** | Sad Path   | Pagination exceeds max limit            | `?per_page=105`                   | `400 Bad Request` | Error details state: `per_page must not be greater than 100`.                                      |
| **TC-10** | Sad Path   | Pagination zero boundary                | `?per_page=0`                     | `400 Bad Request` | Error details state: `per_page must not be less than 1`.                                           |
| **TC-11** | Sad Path   | Invalid status enum                     | `?status=archived`                | `400 Bad Request` | Error details state status must be a valid enum (`draft`, `publish`, etc.).                        |
| **TC-12** | Sad Path   | Invalid orderby attribute               | `?orderby=password`               | `400 Bad Request` | Error details state orderby must be a valid enum (`created_at`, `title`, etc.).                    |
| **TC-13** | Sad Path   | Invalid order direction                 | `?order=diagonal`                 | `400 Bad Request` | Error details state order must be `asc` or `desc`.                                                 |
| **TC-14** | Sad Path   | Wrong data type (String instead of Int) | `?author=abc`                     | `400 Bad Request` | Error details state: `author must be an integer number`.                                           |
| **TC-15** | Sad Path   | Wrong data type (Float instead of Int)  | `?page=1.5`                       | `400 Bad Request` | Error details state: `page must be an integer number`.                                             |
| **TC-16** | Sad Path   | Search string exceeds max length        | `?search=[101_character_string]`  | `400 Bad Request` | Error details state search must be shorter than or equal to 100 characters.                        |
| **TC-17** | Sad Path   | Empty string values                     | `?status=&author=`                | `400 Bad Request` | Error details trigger enum/integer validations because the values are present but empty.           |
| **TC-18** | Edge Case  | Valid parameters, no results            | `?search=NonExistentWord`         | `200 OK`          | Request is valid, but no data matches. Returns `data: []` and `meta.total: 0`.                     |

---

### 3.3 Sad Path Error Response Structure

For all tests resulting in a `400 Bad Request` (TC-08 through TC-17), the system must enforce the Error Schema defined in Spec 0. The assertion must verify the shape of the response.

**Example Assertion payload (TC-08):**

```json
{
  "error": "Bad Request",
  "message": "Validation failed",
  "details": {
    "page": "page must not be less than 1"
  }
}
```
