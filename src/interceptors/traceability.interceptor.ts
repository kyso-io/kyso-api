import { KysoEventEnum, KysoTraceabilityCreateEvent } from '@kyso-io/kyso-model';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import * as geoiIp from 'geoip-country';
import { Observable, tap } from 'rxjs';
import { NATSHelper } from '../helpers/natsHelper';
import { parseJwt } from '../helpers/parse-jwt';
import { DecodedToken } from '../security/decoded-token';

@Injectable()
export class TraceabilityInterceptor implements NestInterceptor {
  private readonly privacySensitiveProperties = ['pass'];
  private readonly ignoreEndpoints = ['/auth/public-permissions', '/kyso-settings/public', '/organizations/slug', '/organizations/info', '/teams/info'];

  constructor(private clientProxy: ClientProxy) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(async () => {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest();
        for (const ignorePath of this.ignoreEndpoints) {
          if (request.originalUrl.includes(ignorePath)) {
            return;
          }
        }
        const response = ctx.getResponse();
        let decodedToken: DecodedToken | null = null;
        if (request.headers?.authorization && request.headers.authorization.startsWith('Bearer ')) {
          const splittedToken: string = request.headers.authorization.split('Bearer ');
          decodedToken = parseJwt(splittedToken[1]);
        }
        if (request.body) {
          const keys: string[] = Object.keys(request.body);
          for (const property of this.privacySensitiveProperties) {
            for (const key of keys) {
              if (key.includes(property)) {
                request.body[key] = '***';
              }
            }
          }
        }
        let ip: string = request.headers['x-forwarded-for'] || request.connection.remoteAddress || '';
        if (ip.substring(0, 7) == '::ffff:') {
          ip = ip.substring(7);
        }
        const geoIpResult: geoiIp.Lookup = geoiIp.lookup(ip);
        NATSHelper.safelyEmit<KysoTraceabilityCreateEvent>(this.clientProxy, KysoEventEnum.TRACEABILITY_CREATE, {
          user_id: decodedToken?.payload?.id || null,
          email: decodedToken?.payload?.email || null,
          endpoint: request.originalUrl,
          http_response_code: response.statusCode,
          user_agent: request.headers['user-agent'],
          ip_address: ip,
          request_method: request.method,
          request_body: request.body !== null && Object.keys(request.body).length > 0 ? request.body : null,
          country: geoIpResult?.country || null,
        });
      }),
    );
  }
}
