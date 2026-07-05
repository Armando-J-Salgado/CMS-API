# Spec 4  Store POST /posts

## Contexto
Los editores necesitan publicar contenido nuevo desde la API, creando posts que cumplan con las validaciones mínimas del recurso.

## Criterios de aceptación
- POST /posts con title y content válidos devuelve 201 y el post creado.
- Si falta title, la API devuelve 422 indicando específicamente que ese campo falló, en el formato estándar de error.
- Si falta content, la API devuelve 422 indicando específicamente que ese campo falló, en el formato estándar de error.
- Si no se envía status, el post se crea con status = draft por defecto.
- Si no se envía slug, se genera automáticamente a partir del title.
- Existen tests que cubren: creación exitosa, validación de title faltante, validación de content faltante y generación automática de slug, todos en verde.

## Alcance
- Endpoint de creación de un post.
- Validación de campos obligatorios.
- Generación automática de slug cuando no se provee.

## Fuera de alcance
- Subida de imágenes.
- Autenticación de autor (se asume que author_id está disponible; no se especifica cómo se obtiene).
- Edición o eliminación de posts.

## Restricciones
- El formato de error debe ser el definido en el Spec 0 (Foundation).
- El status solo puede tomar uno de los valores válidos definidos en el Foundation (draft, publish, pending, private, trash).
- Si se envía status = publish directamente en la creación, debe cumplirse la misma regla del ciclo de vida del post: title y content no pueden estar vacíos    