import { Type, applyDecorators } from '@nestjs/common'
import { ApiOkResponse, getSchemaPath } from '@nestjs/swagger'
import { User } from '../model/user.model'
import { Report } from '../model/report.model'
import { Comment } from '../model/comment.model'
import { Team } from '../model/team.model'
import { Organization } from '../model/organization.model'

const MODELS = [User, Report, Comment, Team, Organization]

export const ApiNormalizedResponse = <TModel extends Type<any>>(args: { status: number; description: string; type: TModel; isArray?: boolean }) => {
    let data: object = {
        $ref: getSchemaPath(args.type),
    }

    if (args.isArray) {
        data = {
            type: 'array',
            items: {
                $ref: getSchemaPath(args.type),
            },
        }
    }

    const relations = {
        anyOf: [...MODELS.map((model) => ({ type: 'object', additionalProperties: { $ref: getSchemaPath(model) } }))],
    }

    return applyDecorators(
        ApiOkResponse({
            status: args.status,
            description: args.description,
            schema: {
                properties: { data, relations },
            },
        }),
    )
}
