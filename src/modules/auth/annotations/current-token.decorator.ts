import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const CurrentToken = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    return request.token
})
