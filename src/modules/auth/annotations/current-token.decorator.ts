import { createParamDecorator, ExecutionContext } from '@nestjs/common'

function parseJwt(token) {
    var base64Payload = token.split('.')[1];
    var payload = Buffer.from(base64Payload, 'base64');
    return JSON.parse(payload.toString());
}

export const CurrentToken = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    
    try {
        const splittedToken = request.headers.authorization.split("Bearer ")
        const decodedToken = parseJwt(splittedToken[1])
        
        return (decodedToken as any).payload
    } catch(ex) {
        return undefined
    }

})
