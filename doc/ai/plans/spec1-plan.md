# Implementation Plan: Index — GET /posts

## Goal Description

The goal is to implement the `GET /api/posts` endpoint for the CMS API, adhering to the requirements specified in `doc/ai/specs/spec1.md`. This includes handling pagination, full-text searching, status/author filtering, and sorting. We will follow a strict Test-Driven Development (TDD) approach and ensure our design aligns with SOLID principles.

## Proposed Implementation Steps (TDD & SOLID)

The implementation will be divided into the following logical steps, following the Red-Green-Refactor cycle.

### 1. Test Setup (Red Phase)

We will start by writing the End-to-End (E2E) tests defined in the Test Matrix (TC-01 through TC-18).
- **Setup:** Configure the test database and seed it with 15 posts (various statuses, authors, dates).
- **Test File:** Create or update `test/posts.e2e-spec.ts` (or the corresponding test file path).
- **Outcome:** All tests will initially fail since the endpoint and validations do not exist.

### 2. DTO & Validation (Green Phase)

Implement the `GetPostsQueryDto` to handle incoming query parameters.
- **File:** `src/posts/dto/get-posts-query.dto.ts`
- **Details:** Apply `class-validator` and `class-transformer` decorators exactly as specified in the spec to handle data transformation and validation rules.
- **Outcome:** The Sad Path tests (TC-08 to TC-17) regarding 400 Bad Request will start passing (assuming the Spec 0 error filter is in place).

### 3. Controller Implementation (Green Phase)

Add the route handler in the Posts Controller.
- **File:** `src/posts/posts.controller.ts`
- **Details:** Add a `@Get()` method that accepts the `@Query() query: GetPostsQueryDto`.
- **SOLID (SRP):** The controller's *only* responsibility will be to receive the request and pass the DTO to the service layer.

### 4. Service & Repository Implementation (Green Phase)

Implement the core logic for querying the database.
- **File:** `src/posts/posts.service.ts`
- **SOLID (SRP & OCP):** The service will handle the business logic. We will abstract the database interactions (e.g., dynamic query building for filtering and searching) behind a repository or a dedicated query builder method to keep the service clean.
- **Details:** Translate the DTO fields (`page`, `per_page`, `search`, `status`, `author`, `orderby`, `order`) into the corresponding database query. Map the result into the expected response format (including the `meta` pagination object).
- **Outcome:** The Happy Path tests (TC-01 to TC-07) and Edge Case (TC-18) will pass.

### 5. Refactoring & Formatting (Refactor Phase)

- Clean up any duplicated logic in the query building process.
- Ensure the code adheres to linting standards.
- Verify that the separation of concerns (Controller -> Service -> Data Access) strictly follows SOLID principles.

## Verification Plan

### Automated Tests
- Run the E2E test suite (e.g., `npm run test:e2e`) to execute the defined E2E Test Matrix.
- Verify that all 18 Test Cases (TC-01 to TC-18) pass with the expected HTTP status codes and payload structures.
