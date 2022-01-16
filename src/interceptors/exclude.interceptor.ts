import { NestInterceptor, Injectable, CallHandler } from '@nestjs/common'
import { classToPlain } from 'class-transformer'
import { map } from 'rxjs/operators'

@Injectable()
export class TransformInterceptor implements NestInterceptor {
    intercept(_: any, next: CallHandler<any>) {
        return next.handle().pipe(
            map((data) => {
                return classToPlain(data)
            }),
        )
    }
}
