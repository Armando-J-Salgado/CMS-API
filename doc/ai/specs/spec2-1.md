# Spec 2-1: Users & Authentication

This document defines a minimal user registration and login flow. It exists as a **prerequisite for Spec 2-2 (Show)**, since author-only visibility rules require knowing the identity of the requester. Depends on Spec 0 (Foundation).

---

## 1. Rationale

Spec 0 defines `Post.author_id` but no mechanism to establish "who is making this request." Spec 2-2's user stories require distinguishing the post's author from any other requester. This spec introduces the smallest possible slice of auth needed to unblock that: register, login, and a guard that resolves the current user from a JWT.

Full authorization (roles, permissions, password reset, email verification, etc.) is explicitly **out of scope** — this is a stub sufficient for ownership checks, not a production auth system.

---

## 2. Folder Structure (additions to Spec 0)

```text
src/
├── users/
│   ├── users.module.ts
│   ├── users.service.ts
│   └── entities/
│       └── user.entity.ts
└── auth/
    ├── auth.module.ts
    ├── auth.controller.ts
    ├── auth.service.ts
    ├── dto/
    │   ├── register.dto.ts
    │   └── login.dto.ts
    ├── guards/
    │   ├── jwt-auth.guard.ts          # Mandatory auth — throws 401 if missing/invalid token
    │   └── optional-jwt-auth.guard.ts # Optional auth — attaches req.user if present, otherwise continues
    └── strategies/
        └── jwt.strategy.ts
test/
└── auth.e2e-spec.ts
```

---

## 3. Database Schema (User Model)

### TypeORM Entity: `src/users/entities/user.entity.ts`
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255, unique: true })
  email!: string;

  @Column({ type: "varchar", length: 255 })
  password_hash!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
```

- `Post.author_id` conceptually references `User.id`. Spec 2-1 does not add a formal FK/relation to keep the change additive to Spec 0; that can be introduced later if needed.

---

## 4. Endpoints

### 4.1 `POST /api/auth/register`
**Body:**
```json
{ "email": "string", "password": "string", "name": "string" }
```
**Behavior:**
- Validates `email` (format, uniqueness) and `password` (min length 8).
- Hashes password with bcrypt before storing.
- Returns the created user (without `password_hash`).

**Response `201 Created`:**
```json
{ "id": 1, "email": "user@example.com", "name": "Jane Doe", "created_at": "..." }
```

**Errors:**
- `400 Bad Request` — validation failure (weak password, malformed email).
- `409 Conflict` — email already registered.

### 4.2 `POST /api/auth/login`
**Body:**
```json
{ "email": "string", "password": "string" }
```
**Behavior:**
- Verifies credentials against stored hash.
- Issues a signed JWT (`sub`: user id, `email`) with a fixed expiry (e.g. 1h — configurable).

**Response `200 OK`:**
```json
{ "access_token": "eyJhbGciOi..." }
```

**Errors:**
- `401 Unauthorized` — invalid email/password (do not reveal which one is wrong).

---

## 5. Auth Guards (used by Spec 2-2 and future specs)

| Guard | Behavior |
|---|---|
| `JwtAuthGuard` | Requires a valid `Authorization: Bearer <token>`. Throws `401 Unauthorized` if missing/invalid. Populates `req.user = { id, email }`. |
| `OptionalJwtAuthGuard` | If a valid token is present, populates `req.user`. If absent or invalid, allows the request through with `req.user = undefined`. Never throws. |

`OptionalJwtAuthGuard` is what Spec 2-2's main show route uses, since anonymous requests must still be able to see published posts.

---

## 6. Error Response Format

Reuses the standard envelope from Spec 0:
```json
{
  "error": "Unauthorized",
  "message": "Invalid credentials",
  "details": {}
}
```

---

## 7. Acceptance Criteria

- A user can register with a unique email and receive a `201` with their public profile.
- Registering with a duplicate email returns `409`.
- A registered user can log in and receive a JWT.
- Logging in with wrong credentials returns `401`.
- A protected route rejects requests without a valid token (`401`).
- A route using `OptionalJwtAuthGuard` succeeds both with and without a token, exposing `req.user` only when a valid token is present.