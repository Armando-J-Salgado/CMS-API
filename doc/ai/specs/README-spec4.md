# Walkthrough: Especificación 4 - Update Post (PATCH/PUT)

Este documento detalla la implementación y el funcionamiento de la funcionalidad de actualización de publicaciones (`PATCH /posts/{id}` y `PUT /posts/{id}`) del CMS API utilizando NestJS, de acuerdo con la [Especificación 4](file:///c:/ESEN/2026/Ciclo%20II/Patrones/CMS-API/doc/ai/specs/spec4.md) y el [Plan de Implementación de Spec 4](file:///c:/ESEN/2026/Ciclo%20II/Patrones/CMS-API/doc/ai/plans/spec4-plan.md).

## Estructura de Archivos Creados y Modificados

- [update-post.dto.ts](file:///c:/ESEN/2026/Ciclo%20II/Patrones/CMS-API/src/posts/dto/update-post.dto.ts) (Nuevo): DTO de validación para actualización parcial (PATCH). Todos los campos son opcionales.
- [replace-post.dto.ts](file:///c:/ESEN/2026/Ciclo%20II/Patrones/CMS-API/src/posts/dto/replace-post.dto.ts) (Nuevo): DTO de validación para reemplazo total (PUT). Los campos `title` y `content` son requeridos.
- [posts.service.ts](file:///c:/ESEN/2026/Ciclo%20II/Patrones/CMS-API/src/posts/posts.service.ts) (Modificado): Implementación de la lógica de negocio del ciclo de vida del post, validación de transiciones, auto-generación de slug y preparación para JWT.
- [posts.controller.ts](file:///c:/ESEN/2026/Ciclo%20II/Patrones/CMS-API/src/posts/posts.controller.ts) (Modificado): Definición de los endpoints `/posts/:id` (PATCH) y `/posts/:id` (PUT) con sus decoradores de Swagger correspondientes.
- [main.ts](file:///c:/ESEN/2026/Ciclo%20II/Patrones/CMS-API/src/main.ts) (Modificado): Registro global de `ValidationPipe` para habilitar el uso automático de `class-validator` y la transformación de tipos.
- [posts-update.e2e-spec.ts](file:///c:/ESEN/2026/Ciclo%20II/Patrones/CMS-API/test/posts-update.e2e-spec.ts) (Nuevo): Set de pruebas E2E para todos los escenarios y reglas de negocio.

---

## Detalles de Implementación y Reglas de Negocio

### 1. Bloqueo de Papelera (`trash`)
Un post que ya está en estado `trash` no se puede modificar directamente. La única operación de actualización permitida es la restauración (cambiar su estado a otro diferente de `trash`). Si no se incluye el cambio de estado, o se intenta mantener en `trash`, se lanza una excepción de entidad no procesable (422).

> [!IMPORTANT]
> Mensaje de error para este bloqueo: `"Un post en trash no puede ser actualizado directamente. Restáuralo primero."`

### 2. Validación de Transición a `publish`
Un post solo puede cambiar a estado `publish` si tiene título y contenido no vacíos. Esto se evalúa considerando el estado final resultante de aplicar el body enviado. Si no cumple este requisito, se lanza una excepción 422.

### 3. Ciclo de Vida y Fechas Automáticas
- **`published_at`**: Se setea al timestamp actual únicamente la primera vez que el post cambia a `publish`. Si ya fue publicado anteriormente, se mantiene la fecha original.
- **`deleted_at`**: Se setea al timestamp actual cuando el post transiciona a `trash`. Si el post sale de `trash` (es restaurado a otro estado como `draft`), se limpia a `null`.

### 4. Auto-generación y Unicidad del `slug`
Si el campo `title` es modificado y el body no contiene un `slug` explícito, se autogenera un slug limpio y amigable utilizando el título. Además, para cualquier actualización del slug (ya sea manual o automática), se realiza un chequeo previo en la base de datos para garantizar la unicidad del slug, retornando un error 422 en caso de conflicto.

### 5. Preparación para JWT
El método `update` en el servicio acepta un parámetro opcional `currentUserId`. Si se provee, el servicio valida que el `author_id` del post coincida con `currentUserId`. Si no coincide, lanza una excepción de acceso denegado (403 Forbidden). Esto deja el backend listo para una fácil integración de un `JwtAuthGuard` en el controlador.

---

## Ejecución de Pruebas E2E

Las pruebas E2E validan todos los flujos de negocio definidos. Puedes ejecutar el set completo de pruebas utilizando el siguiente comando:

```bash
npm run test:e2e
```
