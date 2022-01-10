import { ApiProperty, getSchemaPath } from '@nestjs/swagger'
import { User } from '../user.model'
import { Report } from '../report.model'
import { Comment } from '../comment.model'
import { Team } from '../team.model'
import { Organization } from '../organization.model'

const MODELS = [User, Report, Comment, Team, Organization]

export class NormalizedResponse {
    @ApiProperty({
        description: 'The specific data that has been requested, it is an array or object',
        example: 'a report, or list of reports',
        oneOf: [
            ...MODELS.map((model) => ({ $ref: getSchemaPath(model) })),
            ...MODELS.map((model) => ({ type: 'array', items: { $ref: getSchemaPath(model) } })),
        ],
    })
    data: object | object[]

    @ApiProperty({
        description: 'object with all the fetched relations',
        anyOf: [...MODELS.map((model) => ({ type: 'object', additionalProperties: { $ref: getSchemaPath(model) } }))],
    })
    relations: object

    constructor(data, relations?) {
        this.data = data

        data.buildHatoes(relations)

        console.log(relations.user['61d72cfe565282538793ebd8'].buildHatoes)

        this.relations = relations
    }
}
