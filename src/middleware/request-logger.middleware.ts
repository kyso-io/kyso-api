import { Token } from '@kyso-io/kyso-model';
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';

import { Request, Response, NextFunction } from 'express';
import { Autowired } from 'src/decorators/autowired';
import { AuthService } from 'src/modules/auth/auth.service';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  @Autowired({ typeName: 'AuthService' })
  private authService: AuthService;

  use(request: Request, response: Response, next: NextFunction): void {
    const startTime = process.hrtime();
    const { method, baseUrl } = request;
    let ip = '';
    const userAgent = request.get('user-agent') || '';
    const host = request.get('host') || '';
    const authHeader = request.get('authorization') || null;
    const protocol = request.protocol || '';

    const remoteAddress = request.socket.remoteAddress;
    const xForwardedFor = request.get('x-forwarded-for') || null;

    console.log(request.rawHeaders);

    if (xForwardedFor) {
      ip = xForwardedFor;
    } else {
      ip = remoteAddress;
    }

    response.on('close', () => {
      const totalTime = process.hrtime(startTime);
      const totalTimeInMs = totalTime[0] * 1000 + totalTime[1] / 1e6;

      const { statusCode } = response;
      const contentLength = response.get('content-length');

      let invoker = null;

      if (authHeader) {
        const token: Token = this.authService.evaluateAndDecodeTokenFromHeader(authHeader);

        if (token) {
          invoker = {
            userId: token.id,
            username: token.username,
          };
        }
      }

      const loggingLine = {
        timestamp: Date.now(),
        method: method,
        protocol: protocol,
        host: host,
        baseUrl: baseUrl,
        statusCode: statusCode,
        contentLengthInBytes: contentLength,
        userAgent: userAgent,
        sourceIp: ip,
        ellapsedTimeInMs: totalTimeInMs,
        invoker: invoker,
      };

      // Using console.log here for better processing for 3rd party tools
      console.log(JSON.stringify(loggingLine));
      this.logger.log(`${method} ${baseUrl} ${statusCode} ${contentLength} - ${userAgent} ${ip}`);
    });

    next();
  }
}
