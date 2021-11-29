import { Logger } from '@nestjs/common';

export class ErrorHandling {
  static readonly ERROR_TO_HTTP_CODE = {
    InvalidInputError: 400,
    UnauthorizedError: 401,
    ForbiddenError: 403,
    NotFoundError: 404,
    AlreadyExists: 409,
  };

  static getHttpErrorCode(err) {
    return err.status || this.ERROR_TO_HTTP_CODE[err.constructor.name] || 500;
  }

  static errorHandler(err, req, res, next) {
    let code = this.getHttpErrorCode(err);
    Logger.error(err);

    if (code >= 100 && code < 200) {
      code = 400;
    }

    res.status(code).send({ error: err.message || 'Something went wrong' });
  }

  static stringify(error) {
    const { cause, stack, name, message } = error;

    let str = stack ? `${stack}` : `${name}: ${message}`;
    if (cause) {
      const causeStr = ErrorHandling.stringify(cause).split('\n').join('\n\t');
      str = `${str}\n\n\t${causeStr}`;
    }

    return str;
  }
}

// Errors
export class KysoError extends Error {
  message: any;
  cause: any;

  constructor(message, cause) {
    super(message);
    this.name = this.constructor.name;
    this.cause = cause;
  }

  toString() {
    return ErrorHandling.stringify(this);
  }
}

export class AlreadyExistsError extends KysoError {
  constructor(args) {
    super(
      args.message || 'A resource with the same identification already exists',
      args.cause,
    );
  }
}

export class ForbiddenError extends KysoError {
  constructor(args) {
    super(
      args.message || 'You are not allowed to perform this action',
      args.cause,
    );
  }
}

export class InternalError extends KysoError {
  constructor(args) {
    super(args.message || 'Internal error', args.cause);
  }
}

export class InvalidInputError extends KysoError {
  constructor(args) {
    super(args.message || 'Input is not correct', args.cause);
  }
}

export class NotFoundError extends KysoError {
  constructor(args) {
    super(
      args.message || "The resource you are trying to access can't be found",
      args.cause,
    );
  }
}

export class UnauthorizedError extends KysoError {
  constructor(args) {
    super(
      args.message || 'You need to be authenticated to execute this action',
      args.cause,
    );
  }
}
