# Spec 1-1: Index Auth — GET /posts

This document defines the requirements and behavior for integrating JWT authorization into the Post Index endpoint (`GET /posts`). It details how the endpoint controls visibility of private, unpublished, and trashed posts based on the requester's identity.

---

## 1. Rationale

Currently, `GET /api/posts` returns posts matching the requested `status` (which defaults to `publish`) without verifying ownership or authentication. This allows anonymous users or other authors to view unpublished posts (`draft`, `pending`, `private`) and trashed posts (`trash`) of any author, violating basic privacy rules.

This specification:
- Restricts retrieval of non-public statuses (`draft`, `pending`, `private`, `trash`) to their respective author.
- Integrates `OptionalJwtAuthGuard` into the index endpoint.
- Validates that requests for non-public statuses are authenticated (returning `401 Unauthorized` if not).
- Validates ownership of non-public statuses, returning `403 Forbidden` if a user requests non-public posts belonging to another author.

---

## 2. Visibility Rules & Decision Matrix

The endpoint uses `OptionalJwtAuthGuard` to identify the requester if a JWT is provided.

### 2.1 Request & Status Matrix

| Requested `status` | Requester is Anonymous | Requester is Authenticated (`req.user.id = X`) |
| :--- | :--- | :--- |
| `publish` *(default)* | **200 OK**<br>Returns all published posts. | **200 OK**<br>Returns all published posts. |
| `draft` / `pending` / `private` / `trash` | **401 Unauthorized**<br>Authentication is required. | **200 OK**<br>Returns ONLY posts of the requested status where `author_id === X` (or legacy posts where `author_id IS NULL`, if allowed). |

### 2.2 Co-existence with `author` Parameter

The `author` query parameter filters posts by author ID. When combined with a status, the behavior is:

- **When `status === 'publish'`**:
  - `?status=publish&author=Y`: Returns all published posts by author `Y` (accessible to anyone).
- **When `status` is not `publish` (e.g., `draft`)**:
  - If `author === X` (requester's own ID): Returns user `X`'s drafts (**200 OK**).
  - If `author` parameter is omitted: Returns user `X`'s drafts (**200 OK**).
  - If `author === Y` (different author): Returns **403 Forbidden** (cannot query unpublished posts of another user).

---

## 3. Error Response Format

Errors follow the Spec 0 standard JSON envelope:

### 3.1 401 Unauthorized
Thrown when an anonymous user requests a status other than `publish`.
```json
{
  "error": "Unauthorized",
  "message": "Unauthorized",
  "details": {}
}
```

### 3.2 403 Forbidden
Thrown when an authenticated user requests a non-public status and filters by another author's ID (`author` query param !== `req.user.id`).
```json
{
  "error": "Forbidden",
  "message": "You do not have access to view unpublished posts of other authors.",
  "details": {}
}
```

---

## 4. Test Cases & E2E Matrix

New E2E tests must be added to [posts-index.e2e-spec.ts](file:///d:/ESEN/Anio-3/Ciclo-2/Patrones/CMS-API/test/posts-index.e2e-spec.ts) covering the following security scenarios:

| Test ID | Category | Description | Query Parameters | Headers | Expected Status | Expected Behavior / Assertion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-19** | Happy Path | View own draft posts | `?status=draft` | `Bearer User1_Token` | `200 OK` | Returns drafts where `author_id === User1.id`. |
| **TC-20** | Happy Path | View own draft posts with explicit author | `?status=draft&author=1` | `Bearer User1_Token` | `200 OK` | Returns drafts where `author_id === User1.id`. |
| **TC-21** | Sad Path | View drafts anonymously | `?status=draft` | *(None)* | `401 Unauthorized` | Rejects with 401. |
| **TC-22** | Sad Path | View other author's drafts | `?status=draft&author=2` | `Bearer User1_Token` | `403 Forbidden` | Rejects with 403. |
| **TC-23** | Happy Path | View own trashed posts | `?status=trash` | `Bearer User1_Token` | `200 OK` | Returns trashed posts where `author_id === User1.id`. |
| **TC-24** | Sad Path | View other author's trashed posts | `?status=trash&author=2` | `Bearer User1_Token` | `403 Forbidden` | Rejects with 403. |
| **TC-25** | Happy Path | Legacy posts visibility (draft) | `?status=draft` | `Bearer User1_Token` | `200 OK` | Returns User 1's drafts and any draft posts where `author_id IS NULL`. |
