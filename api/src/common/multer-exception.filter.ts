import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

/** Maps multer's LIMIT_FILE_SIZE into the same 400 the service returns. */
@Catch()
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const code =
      typeof exception === 'object' && exception !== null && 'code' in exception
        ? (exception as { code?: string }).code
        : undefined;
    if (code === 'LIMIT_FILE_SIZE') {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Максимальный размер файла — 10 МБ.',
        error: 'Bad Request',
      });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(exception.getResponse());
      return;
    }
    throw exception;
  }
}
