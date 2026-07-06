# Plan de Implementación: Spec 2-1 - Users & Authentication (NestJS)

Este documento detalla los pasos para implementar el flujo mínimo de registro y login descrito en [spec2-1-users-auth.md](spec2-1-users-auth.md). Depende de Spec 0 (Foundation).

## Alcance del Plan
Implementar el módulo de usuarios y autenticación (registro, login, guards JWT) con lógica de negocio real y cobertura de tests, siguiendo TDD.

## Tareas a Realizar

### 1. Dependencias nuevas
- `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`, `@types/passport-jwt`, `@types/bcrypt`.

### 2. Entidad y módulo de Usuarios
- Crear `src/users/entities/user.entity.ts` según spec.
- Crear `UsersModule` y `UsersService` con métodos: `findByEmail`, `create`, `findById`.

### 3. Módulo de Autenticación
- Crear `AuthModule`, `AuthController`, `AuthService`.
- Implementar `POST /api/auth/register`: validar DTO, verificar unicidad de email, hashear password con bcrypt, persistir usuario.
- Implementar `POST /api/auth/login`: validar credenciales, firmar JWT con `sub` y `email`.
- Configurar `JwtModule` con secret vía variable de entorno y expiración configurable.

### 4. Guards y Estrategia JWT
- Implementar `JwtStrategy` (passport-jwt) que valida el token y retorna `{ id, email }`.
- Implementar `JwtAuthGuard` (obligatorio) — 401 si no hay token válido.
- Implementar `OptionalJwtAuthGuard` — no lanza error si no hay token, solo popula `req.user` si es válido.

### 5. DTOs y Validación
- `RegisterDto`: email (formato válido), password (mínimo 8 caracteres), name (no vacío).
- `LoginDto`: email, password.
- Usar `class-validator` / `ValidationPipe` global ya existente o configurarlo si no está.

### 6. Manejo de Errores
- Reutilizar el filtro de excepciones global de Spec 0 para mantener el envelope de error consistente.
- Mapear conflicto de email duplicado a `409 Conflict`.

## Tests (TDD) — `test/auth.e2e-spec.ts`

| # | Caso | Resultado esperado |
|---|------|---------------------|
| 1 | Registro con datos válidos | `201`, retorna usuario sin `password_hash` |
| 2 | Registro con email duplicado | `409` |
| 3 | Registro con password < 8 caracteres | `400` |
| 4 | Registro con email malformado | `400` |
| 5 | Login con credenciales correctas | `200`, retorna `access_token` |
| 6 | Login con password incorrecto | `401` |
| 7 | Login con email no registrado | `401` |
| 8 | Acceso a ruta protegida sin token | `401` |
| 9 | Acceso a ruta protegida con token válido | `200`, `req.user` poblado |
| 10 | Acceso a ruta con `OptionalJwtAuthGuard` sin token | pasa, `req.user` es `undefined` |
| 11 | Acceso a ruta con `OptionalJwtAuthGuard` con token válido | pasa, `req.user` poblado |

## Orden sugerido de implementación
1. Entidad `User` + `UsersService` (con tests unitarios básicos de creación/búsqueda).
2. `AuthService.register` + test #1-4.
3. `AuthService.login` + test #5-7.
4. `JwtStrategy` + `JwtAuthGuard` + test #8-9.
5. `OptionalJwtAuthGuard` + test #10-11.