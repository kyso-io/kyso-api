import { Type, applyDecorators } from '@nestjs/common'
import { ApiOkResponse, getSchemaPath } from '@nestjs/swagger'

export const ApiNormalizedResponse = <TModel extends Type<any>>(args: { status: number; description: string; type: TModel }) => {
    return applyDecorators(
        ApiOkResponse({
            status: args.status,
            description: args.description,
            schema: {
                properties: {
                    data: {
                        oneOf: [
                            {
                                $ref: getSchemaPath(args.type),
                            },
                            {
                                type: 'array',
                                items: {
                                    $ref: getSchemaPath(args.type),
                                },
                            },
                        ],
                    },
                    relations: {
                        type: 'array',
                    },
                },
            },
        }),
    )
}
