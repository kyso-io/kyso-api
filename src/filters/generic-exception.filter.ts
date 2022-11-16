import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

/**
 * Global exception filter. Every exception that is raised up in the API is catched automatically
 * by this piece of code.
 *
 * The idea behind this one is to avoid restarts of the API due non-catched exception, and to know as well
 * what is happening in the API
 */
@Catch()
export class GenericExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const isHttpException = exception instanceof HttpException;

    const statusCode = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception.message;
    const extendedMessage = isHttpException ? (exception as any).response.message : '';

    const devErrorResponse: any = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      errorName: exception?.name,
      message: message,
      extendedMessage: Array.isArray(extendedMessage) ? extendedMessage : [extendedMessage],
    };

    const prodErrorResponse: any = {
      statusCode,
      message: message,
      extendedMessage: Array.isArray(extendedMessage) ? extendedMessage : [extendedMessage],
    };

    Logger.error(`${request.method} ${request.originalUrl} ${statusCode}`, devErrorResponse);
    Logger.error(exception.stack);

    response.status(statusCode).json(process.env.NODE_ENV === 'development' ? devErrorResponse : prodErrorResponse);
  }
}
