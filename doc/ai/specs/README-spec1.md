# Walkthrough: Especificación 1 y 1-1 - Index y Autorización de Posts (GET /posts)

Este documento detalla la implementación, el funcionamiento de la funcionalidad de listado de publicaciones (`GET /posts`) del CMS API utilizando NestJS, y cómo probarla para una demo interactiva, de acuerdo con la [Especificación 1 (Index)](file:///d:/ESEN/Anio-3/Ciclo-2/Patrones/CMS-API/doc/ai/specs/spec1.md) y la [Especificación 1-1 (Index Auth)](file:///d:/ESEN/Anio-3/Ciclo-2/Patrones/CMS-API/doc/ai/specs/spec1-1.md).

## Estructura de Archivos Creados y Modificados

- [get-posts-query.dto.ts](file:///d:/ESEN/Anio-3/Ciclo-2/Patrones/CMS-API/src/posts/dto/get-posts-query.dto.ts) (Nuevo): DTO de validación y transformación para los parámetros de la consulta (query params), aplicando `class-validator` y `class-transformer`.
- [posts.service.ts](file:///d:/ESEN/Anio-3/Ciclo-2/Patrones/CMS-API/src/posts/posts.service.ts) (Modificado): Implementación de la lógica de negocio para paginación, filtros (estado, autor, búsqueda por texto libre) y reglas de acceso privado.
- [posts.controller.ts](file:///d:/ESEN/Anio-3/Ciclo-2/Patrones/CMS-API/src/posts/posts.controller.ts) (Modificado): Definición del endpoint `GET /posts` protegido por `OptionalJwtAuthGuard`.
- [posts-index.e2e-spec.ts](file:///d:/ESEN/Anio-3/Ciclo-2/Patrones/CMS-API/test/posts-index.e2e-spec.ts) (Nuevo): Set de pruebas de integración E2E para todos los escenarios (casos felices, tristes y de control de acceso).

---

## Detalles de Implementación y Reglas de Negocio

El listado de posts soporta una variedad de parámetros opcionales con reglas bien definidas para la demo:

### 1. Paginación y Valores por Defecto
Por defecto, si no se envían parámetros, la API devuelve los posts con estado `publish` ordenados de forma descendente por su fecha de creación (`created_at`).
- **Valores por defecto:** `page = 1`, `per_page = 10`.
- **Rango permitido de `per_page`:** Mínimo 1, Máximo 100.
- **Rango permitido de `page`:** Mínimo 1.
- *Cualquier valor fuera de estos rangos retorna un error `400 Bad Request` indicando el campo fallido.*

### 2. Filtro de Visibilidad y Reglas de Seguridad (JWT)
El endpoint utiliza `OptionalJwtAuthGuard`. Esto significa que si se provee un token de autorización JWT válido en los Headers, se identifica al usuario. Si no, se procesa como una petición anónima.

- **Posts Públicos (`status = publish`)**: 
  - Accesibles para cualquiera (con o sin autenticación).
  - Admite filtrar por cualquier autor utilizando el parámetro `author`.
- **Posts Privados/Borradores/Papelera (`status` igual a `draft`, `pending`, `private`, `trash`)**:
  - **Requisito 1 (Autenticación):** Si se solicita un estado no público de manera anónima, el sistema devuelve `401 Unauthorized`.
  - **Requisito 2 (Propiedad/Autoría):** Si un usuario autenticado intenta listar borradores de otro autor (e.g. `?status=draft&author=Y` donde `Y` no es su ID), el sistema devuelve `403 Forbidden`.
  - **Resultado Esperado:** Un usuario autenticado exitosamente solo puede ver sus propios posts no públicos (o posts heredados/legados donde `author_id` sea `null`).

### 3. Búsqueda por Texto (`search`)
La búsqueda realiza una coincidencia parcial e insensible a mayúsculas y minúsculas (case-insensitive) sobre las columnas `title` y `content` utilizando `LIKE` de SQL. El parámetro `search` tiene un límite máximo de 100 caracteres.

### 4. Ordenamiento dinámico (`orderby` y `order`)
Se puede ordenar por los campos `created_at`, `updated_at`, `title` e `id` en orden `asc` o `desc`. Todos los parámetros no permitidos son rechazados inmediatamente por el validador DTO.

---

## Guía paso a paso para la Demo

Para realizar la demostración interactiva de esta funcionalidad, se pueden utilizar las pruebas automatizadas o peticiones vía herramientas como Postman/cURL siguiendo estos escenarios:

### Escenario A: Consulta Pública Anónima (Happy Path)
1. Realizar una petición a `GET /api/posts` sin cabeceras de autorización.
2. Comprobar que devuelve una lista paginada (máximo 10 elementos) que contiene únicamente publicaciones con `"status": "publish"`.
3. Comprobar la presencia del objeto `meta` con la estructura de paginación:
   ```json
   {
     "data": [...],
     "meta": {
       "total": 10,
       "pages": 1,
       "current_page": 1,
       "per_page": 10
     }
   }
   ```

### Escenario B: Paginación y Ordenamiento
1. Enviar una solicitud con parámetros personalizados: `GET /api/posts?page=2&per_page=5&orderby=title&order=asc`.
2. Verificar que se devuelve la segunda página con exactamente 5 elementos ordenados alfabéticamente por título.

### Escenario C: Búsqueda y Filtro de Autor
1. Buscar posts que contengan una palabra específica: `GET /api/posts?search=NestJS`.
2. Filtrar publicaciones de un autor específico: `GET /api/posts?author=2`.

### Escenario D: Validación de Parámetros Erróneos (Sad Paths)
1. Solicitar una página negativa: `GET /api/posts?page=-1`.
   * Verificar respuesta `400 Bad Request` indicando que `page must not be less than 1`.
2. Solicitar demasiados posts por página: `GET /api/posts?per_page=105`.
   * Verificar respuesta `400 Bad Request` indicando que `per_page must not be greater than 100`.
3. Intentar ordenar por una columna restringida o inválida: `GET /api/posts?orderby=password`.
   * Verificar respuesta `400 Bad Request`.

### Escenario E: Seguridad y Permisos (Spec 1-1)
1. Intentar acceder a borradores de manera anónima: `GET /api/posts?status=draft`.
   * Verificar respuesta `401 Unauthorized`.
2. Autenticarse como **User 1** e intentar ver borradores:
   * Enviar la cabecera `Authorization: Bearer [User 1 Token]`.
   * Realizar la petición: `GET /api/posts?status=draft`.
   * Verificar respuesta `200 OK` conteniendo únicamente los borradores de **User 1** (y borradores heredados/legados con `author_id: null`).
3. Intentar ver borradores del **User 2** usando el Token de **User 1**:
   * Enviar la cabecera `Authorization: Bearer [User 1 Token]`.
   * Realizar la petición: `GET /api/posts?status=draft&author=[User 2 ID]`.
   * Verificar respuesta `403 Forbidden` con el mensaje: `"You do not have access to view unpublished posts of other authors."`

---

## Ejecución de Pruebas E2E

El set completo de pruebas e2e cubre los 25 casos de prueba listados en las especificaciones. Ejecuta el comando siguiente para validar todo el funcionamiento:

```bash
npm run test:e2e -- test/posts-index.e2e-spec.ts
```
