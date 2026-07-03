import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from "@nestjs/common";
import { Response } from "express";

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let error = "Error";
    let message = exception.message;
    let details: any = null;

    if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
      error = (exceptionResponse as any).error || error;
      message = (exceptionResponse as any).message || message;
      details = (exceptionResponse as any).details || null;
    }

    response.status(status).json({
      error,
      message,
      ...(details ? { details } : {}),
    });
  }
}
