import { HttpException, HttpStatus } from "@nestjs/common";

export class AppError extends HttpException {
  constructor(message: string, status: HttpStatus, details?: any) {
    super({ error: HttpStatus[status], message, details }, status);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: any) {
    super(message, HttpStatus.NOT_FOUND, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: any) {
    super(message, HttpStatus.BAD_REQUEST, details);
  }
}
