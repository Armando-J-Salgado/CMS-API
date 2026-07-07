# CMS API

API REST para la gestión de publicaciones (posts), inspirada en las convenciones de la WordPress REST API. Construida con **NestJS**, **TypeORM** y **SQLite** (`better-sqlite3`), con documentación interactiva vía **Swagger** y cobertura completa de pruebas E2E.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | NestJS 11 |
| ORM | TypeORM 0.3 |
| Base de Datos | SQLite (`better-sqlite3`) |
| Autenticación | Passport + JWT (`passport-jwt`) |
| Validación | `class-validator` + `class-transformer` |
| Documentación | `@nestjs/swagger` |
| Testing | Jest + Supertest (E2E) |

---

## Instalación y Puesta en Marcha

```bash
# Instalar dependencias
npm install

# Modo desarrollo (hot-reload)
npm run start:dev

# Modo producción (compilar primero)
npm run build
npm run start:prod
```

La API estará disponible en `http://localhost:3000/api`.  
La documentación Swagger interactiva estará en `http://localhost:3000/api/docs`.

---

## Endpoints disponibles

### Autenticación

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Registrar un nuevo usuario | No |
| `POST` | `/api/auth/login` | Iniciar sesión y obtener JWT | No |

### Posts

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `GET` | `/api/posts` | Listar posts con paginación y filtros | Opcional |
| `GET` | `/api/posts/:id` | Obtener un post por ID | Opcional |
| `GET` | `/api/posts/:id/trash` | Ver un post en la papelera | Requerida |
| `POST` | `/api/posts` | Crear un nuevo post | Requerida |
| `PATCH` | `/api/posts/:id` | Actualización parcial de un post | Requerida |
| `PUT` | `/api/posts/:id` | Reemplazo total de un post | Requerida |
| `DELETE` | `/api/posts/:id` | Mover a papelera o eliminar definitivamente | Requerida |
| `POST` | `/api/posts/:id/restore` | Restaurar un post desde la papelera | Requerida |

---

## Modelo del Recurso `Post`

```json
{
  "id": 1,
  "title": "Mi primer post",
  "content": "Contenido del post",
  "excerpt": null,
  "slug": "mi-primer-post",
  "status": "draft",
  "author_id": 1,
  "published_at": null,
  "deleted_at": null,
  "created_at": "2026-07-01T17:00:00.000Z",
  "updated_at": "2026-07-01T17:00:00.000Z"
}
```

### Estados válidos

| Estado | Descripción |
|---|---|
| `draft` | Borrador (estado por defecto) |
| `publish` | Publicado y visible públicamente |
| `pending` | En revisión |
| `private` | Privado, solo visible para el autor |
| `trash` | En papelera, no accesible via `/posts/:id` |

---

## Formato de Error Estándar

Todos los errores siguen un esquema JSON consistente:

```json
{
  "error": "Unprocessable Entity",
  "message": "Validation failed",
  "details": {
    "title": "title should not be empty"
  }
}
```

---

## Pruebas

```bash
# Pruebas unitarias
npm run test

# Pruebas E2E (todos los archivos)
npm run test:e2e

# Reporte de cobertura
npm run test:cov
```

---

## Documentación de Especificaciones

El directorio [`doc/ai/specs/`](./doc/ai/specs/) contiene el walkthrough de cada especificación implementada. Los planes de implementación se encuentran en [`doc/ai/plans/`](./doc/ai/plans/).

### Resumen de Especificaciones

| Spec | Feature | Endpoints | Walkthrough |
|---|---|---|---|
| **Spec 0** | Foundation — Modelo de datos, filtro de errores y esqueleto del proyecto | — | — |
| **Spec 1** | Index — Listar posts con paginación, filtros, búsqueda y control de acceso | `GET /posts` | [README-spec1](./doc/ai/specs/README-spec1.md) |
| **Spec 2** | Users, Auth & Show — Registro, login JWT y visualización de un post | `POST /auth/register`, `POST /auth/login`, `GET /posts/:id` | [README-spec2](./doc/ai/specs/README-spec2.md) |
| **Spec 3** | Store — Crear un post con validación, slug automático y JWT | `POST /posts` | [README-spec3](./doc/ai/specs/README-spec3.md) |
| **Spec 4** | Update — Actualización parcial y total con ciclo de vida del post | `PATCH /posts/:id`, `PUT /posts/:id` | [README-spec4](./doc/ai/specs/README-spec4.md) |
| **Spec 5** | Delete — Soft-delete y force-delete con control de autoría | `DELETE /posts/:id` | [README-spec5](./doc/ai/specs/README-spec5.md) |
| **Spec 6** | Restore & Trash View — Restaurar un post y ver posts en papelera | `POST /posts/:id/restore`, `GET /posts/:id/trash` | [README-spec6](./doc/ai/specs/README-spec6.md) |

### Ciclo de Vida de un Post

```
            ┌──────────┐
  (create)  │  draft   │◄─────────────────────────────┐
─────────► │          │                              │ restore
            └────┬─────┘                              │
                 │                              ┌─────┴────┐
          update │ (status change)              │  trash   │
                 │                              └──────────┘
         ┌───────┼───────────┐                       ▲
         ▼       ▼           ▼                       │ DELETE
     pending  private    publish           ──────────┘ (soft)
                          (published_at set)
```

> **Regla clave:** Un post solo puede pasar a `publish` si tiene `title` y `content` no vacíos.  
> Un post en `trash` no acepta actualizaciones directas; primero debe ser restaurado.
