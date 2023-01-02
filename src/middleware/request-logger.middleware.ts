import { Token } from '@kyso-io/kyso-model';
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';

import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { Autowired } from 'src/decorators/autowired';
import { AuthService } from 'src/modules/auth/auth.service';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  @Autowired({ typeName: 'AuthService' })
  private authService: AuthService;

  use(request: Request, response: Response, next: NextFunction): void {
    const startTime = process.hrtime();
    const { ip, method, baseUrl } = request;
    const userAgent = request.get('user-agent') || '';
    const host = request.get('host') || '';
    const authHeader = request.get('authorization') || null;
    const protocol = request.protocol || '';

    response.on('close', () => {
      const totalTime = process.hrtime(startTime);
      const totalTimeInMs = totalTime[0] * 1000 + totalTime[1] / 1e6;

      const { statusCode } = response;
      const contentLength = response.get('content-length');

      let invoker = null;

      if (authHeader) {
        const token: Token = this.authService.evaluateAndDecodeTokenFromHeader(authHeader);
        invoker = {
          userId: token.id,
          username: token.username,
        };
      }

      const loggingLine = {
        timestamp: Date.now(),
        method: method,
        host: host,
        baseUrl: baseUrl,
        statusCode: statusCode,
        contentLengthInBytes: contentLength,
        userAgent: userAgent,
        sourceIp: ip,
        ellapsedTimeInMs: totalTimeInMs,
        invoker: invoker,
      };

      console.log(JSON.stringify(loggingLine));
      this.logger.log(`${method} ${baseUrl} ${statusCode} ${contentLength} - ${userAgent} ${ip}`);
    });

    next();
  }
}
