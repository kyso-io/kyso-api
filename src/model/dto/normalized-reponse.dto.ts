import { ApiProperty, getSchemaPath } from '@nestjs/swagger'
import { User } from '../user.model'
import { Report } from '../report.model'
import { Comment } from '../comment.model'
import { Team } from '../team.model'
import { Organization } from '../organization.model'
import { BaseModel } from '../base.model'
import { Relations } from '../relations.model'
import { classToPlain } from 'class-transformer'
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

    constructor(data: BaseModel | BaseModel[] | any, relations?: Relations) {
        this.data = data

        if (Array.isArray(data)) {
            if (data[0]) {
                // We assume that all the objects in the array are of the same type...
                if (data[0] instanceof BaseModel) {
                    data.map((x) => x.buildHatoes(relations))
                }
            }
        } else if (data instanceof BaseModel) {
            data.buildHatoes(relations)
        }

        this.relations = relations

        if (!this.relations) return

        const keys = Object.keys(relations)
        this.relations = keys.reduce((prev, key) => {
            const collection = relations[key]
            const ids = Object.keys(collection)

            prev[key] = ids.reduce((last, id) => {
                const model = relations[key][id]

                if (model instanceof BaseModel) {
                    model.buildHatoes(relations)
                }

                last[id] = model
                return last
            }, {})

            return prev
        }, {})
    }
}
