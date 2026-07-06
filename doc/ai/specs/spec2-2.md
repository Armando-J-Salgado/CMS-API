# Spec 2-2: Show — `GET /posts/{id}`

This document defines the behavior of the single-post retrieval endpoint. Depends on Spec 0 (Foundation) and Spec 2-1 (Users & Authentication).

---

## 1. Endpoints

### 1.1 `GET /api/posts/{id}` — Main show route
Uses `OptionalJwtAuthGuard` (auth is optional; anonymous requests are allowed).

**Visibility rules, evaluated in order:**

| Post status | Requester is the author | Requester is not the author (incl. anonymous) |
|---|---|---|
| `publish` | `200 OK` | `200 OK` |
| `draft` / `pending` / `private` | `200 OK` | `403 Forbidden` |
| `trash` | `404 Not Found` *(not accessible here — see 1.2)* | `404 Not Found` |
| does not exist | `404 Not Found` | `404 Not Found` |

Rationale: trashed posts are never exposed through the general show route, even to their author — retrieving a trashed post is a distinct, explicit action handled by its own route (1.2), so that "this post is in the trash" isn't leaked through the generic endpoint. Non-published, non-trashed posts return `403` (not `404`) for non-authors, since the team's decision was to signal "exists but access denied" rather than hide existence.

**Response `200 OK`:**
```json
{
  "id": 1,
  "title": "string",
  "content": "string",
  "excerpt": "string",
  "slug": "string",
  "status": "publish",
  "author_id": 1,
  "created_at": "...",
  "updated_at": "...",
  "published_at": "..."
}
```
(`deleted_at` is omitted from the response body — it's an internal lifecycle field.)

**Errors:**
- `404 Not Found` — post doesn't exist, or exists but is `trash`.
- `403 Forbidden` — post exists, is not `trash`, is not `publish`, and requester is not the author.
- `400 Bad Request` — `{id}` is not a valid identifier (e.g. non-numeric).

### 1.2 `GET /api/posts/{id}/trash` — Trash-specific show route
Uses `JwtAuthGuard` (authentication mandatory — there is no anonymous case here).

**Behavior:**
- Only returns the post if its status is `trash` **and** the requester is its author.
- Intended for reviewing a trashed post's details before deciding to restore it.

| Condition | Result |
|---|---|
| Post exists, status = `trash`, requester is author | `200 OK` (same body shape as 1.1) |
| Post exists, status = `trash`, requester is not author | `403 Forbidden` |
| Post exists, status ≠ `trash` | `404 Not Found` (this route is only for trashed posts) |
| Post does not exist | `404 Not Found` |
| No valid token | `401 Unauthorized` |

---

## 2. Error Response Format
Reuses the Spec 0 envelope:
```json
{
  "error": "Forbidden",
  "message": "You do not have access to this post",
  "details": {}
}
```

---

## 3. User Stories Coverage

| Story | Covered by |
|---|---|
| See a specific published post | 1.1, any requester |
| See a specific draft post as its author | 1.1, author path |
| See a specific private post as its author | 1.1, author path |
| See a specific trashed post as the author, to review before restoring | 1.2 |
| See a specific pending post as its author | 1.1, author path |

---

## 4. Acceptance Criteria
- Happy and error paths covered with tests (see implementation plan for the full matrix).
- Non-author access to non-published, non-trash posts returns `403`, never leaks post content.
- Trash is only ever reachable via the dedicated route, and only by its author.
- Anonymous requests work for published posts and are treated identically to "not the author" for everything else.