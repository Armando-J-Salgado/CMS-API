# Especificación 4: Update Post (PATCH/PUT)

## 1. Visión General
Esta especificación detalla la implementación de los endpoints de actualización de publicaciones (`PATCH /posts/{id}` y `PUT /posts/{id}`) para el CMS API utilizando NestJS. El sistema debe seguir las reglas de negocio del ciclo de vida de un post y, a su vez, debe ser preparado para soportar de manera sencilla autenticación y autorización mediante JWT.

## 2. Preparación para Autenticación/Autorización con JWT
Para asegurar que el sistema esté abierto a extensión para JWT, consideraremos los siguientes puntos durante la implementación:
- **Inferencia de Autor**: Actualmente, `author_id` puede enviarse en el cuerpo de la petición. Sin embargo, en el futuro, este valor debe inferirse del token JWT (`req.user.id`).
- **Control de Acceso**: La actualización de un post debe estar protegida. Dejaremos la estructura lista para inyectar `@UseGuards(JwtAuthGuard)` en el futuro sin modificar la lógica principal.
- **Validación de Propiedad**: En el servicio (`PostsService`), el método `update` debe poder recibir el `user_id` para validar que sólo el autor original o un administrador puedan modificar el post. 

## 3. Lógica de Negocio y Reglas

### 3.1. Restricciones y Estados
- **Bloqueo por Papelera (`trash`)**: Un post que se encuentre en estado `trash` NO puede ser actualizado directamente. Si se intenta, se debe retornar un error `422 Unprocessable Entity` ("Un post en trash no puede ser actualizado directamente. Restáuralo primero.").
- **Validación de Transición a `publish`**: Un post sólo puede cambiar a estado `publish` si tanto `title` como `content` tienen un valor no vacío en el estado final del post. De lo contrario, se retorna `422`.
- **Otras Transiciones**: Si se envía un estado no definido o una transición inválida, se debe retornar `422`.

### 3.2. Ciclo de Vida y Campos Automáticos
- **`published_at`**: Si el post transiciona a `publish` y `published_at` es nulo, se le asigna la fecha y hora actual.
- **`deleted_at`**: Si el post transiciona a `trash`, se le asigna la fecha y hora actual. Si sale de `trash` (es restaurado a otro estado), `deleted_at` se limpia (`null`).
- **Auto-generación de `slug`**: Si el `title` cambia y no se envía un `slug` de manera explícita, el sistema debe generar automáticamente un nuevo slug a partir del nuevo título.
- **`updated_at`**: Se actualizará automáticamente en la base de datos gracias a `@UpdateDateColumn()`.

## 4. Endpoints

### 4.1. `PATCH /posts/:id`
- **Propósito**: Actualización parcial de un post.
- **Body**: Todos los campos son opcionales. (Utiliza `UpdatePostDto`).
- **Respuesta Exitosa**: `200 OK` con el post actualizado.

### 4.2. `PUT /posts/:id`
- **Propósito**: Actualización completa o reemplazo de un post.
- **Body**: `title` y `content` son requeridos. El resto de los campos son opcionales. (Utiliza `ReplacePostDto`).
- **Respuesta Exitosa**: `200 OK` con el post actualizado.

## 5. Archivos Modificados / Creados

- `src/posts/dto/update-post.dto.ts` (Nuevo)
  - Define `UpdatePostDto` utilizando `@nestjs/swagger` y `class-validator`. Ningún campo es obligatorio.
- `src/posts/dto/replace-post.dto.ts` (Nuevo)
  - Define `ReplacePostDto` con `title` y `content` como obligatorios (`@IsNotEmpty()`), y los demás opcionales.
- `src/posts/posts.service.ts` (Modificado)
  - Nuevo método `update(id: number, dto: UpdatePostDto | ReplacePostDto, currentUserId?: number)`.
  - Contendrá toda la lógica de validación de estados, auto-generación de slug y manejo de fechas.
- `src/posts/posts.controller.ts` (Modificado)
  - `@Patch(':id')` y `@Put(':id')` configurados con sus respectivos DTOs.
  - Documentación Swagger añadida con ejemplos y códigos de estado (200, 400, 404, 422).
- `test/posts-update.e2e-spec.ts` o equivalente en `test/` (Modificado/Nuevo)
  - Adición de pruebas E2E para todos los escenarios descritos en la sección de pruebas.

## 6. Escenarios de Pruebas (E2E)

| Escenario | Verbo | Resultado Esperado |
| --- | --- | --- |
| Actualización parcial de un campo (`title`) | `PATCH` | `200 OK` con el campo actualizado |
| Actualización completa con todos los campos | `PUT` | `200 OK` con el recurso reemplazado |
| Falta `title` o `content` en reemplazo total | `PUT` | `400 Bad Request` |
| Post inexistente | `PATCH` / `PUT` | `404 Not Found` |
| Intento de actualizar un post en `trash` | `PATCH` | `422 Unprocessable Entity` |
| Transición a `publish` sin `content` | `PATCH` | `422 Unprocessable Entity` |
| Cambio de `title` sin proveer `slug` | `PATCH` | `200 OK` con el slug regenerado |
| Primera publicación de un post | `PATCH` | `200 OK` con `published_at` definido |
