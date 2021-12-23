import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
    data: T;
}

@Injectable()
export class ExcludeInterceptor<T> implements NestInterceptor<T, any> {
  constructor(private readonly reflector: Reflector) {
    
  }
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('Before...');

    const now = Date.now();
   
    return next.handle().pipe(
        map(data => {
            console.log(data[0].constructor.name)
        })
    );
  }
}
