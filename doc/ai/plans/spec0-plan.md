# Plan de Implementación: Spec 0 - Foundation (NestJS)

Este documento detalla los pasos para configurar la estructura base y los archivos de arquitectura del proyecto CMS API utilizando NestJS de acuerdo con las definiciones de la especificación [spec0.md](file:///c:/Docs/ESEN%202026/Patrones%20de%20dise%C3%B1o/Taller%20DOE/CMS-API/doc/ai/specs/spec0.md).

## Alcance del Plan
Crear la estructura de archivos y directorios base del diseño arquitectónico de NestJS sin implementar lógica de negocio en servicios ni controladores.

## Tareas a Realizar

### 1. Inicialización y Estructura de Directorios (NestJS)
Crear los directorios y archivos placeholder según la arquitectura definida:
- `src/main.ts`
- `src/app.module.ts`
- `src/database/database.config.ts`
- `src/common/filters/http-exception.filter.ts`
- `src/common/errors/app-errors.ts`
- `src/posts/posts.module.ts`
- `src/posts/posts.controller.ts`
- `src/posts/posts.service.ts`
- `src/posts/entities/post.entity.ts`
- `test/health.e2e-spec.ts`
- `test/jest-e2e.json`

### 2. Configuración de Modelos y Entidades
- Crear la entidad TypeORM `Post` en `src/posts/entities/post.entity.ts` con todos los atributos especificados.

### 3. Archivos de Configuración del Proyecto
- Inicializar `package.json` si no existe.
- Configurar dependencias necesarias (`@nestjs/common`, `@nestjs/core`, `@nestjs/swagger`, `@nestjs/typeorm`, `typeorm`, `better-sqlite3`, `reflect-metadata`, etc.).
- Configurar `tsconfig.json` y `nest-cli.json`.
