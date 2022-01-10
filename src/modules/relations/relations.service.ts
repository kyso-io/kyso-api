import { Injectable } from '@nestjs/common'
import { RelationsMongoProvider } from './providers/mongo-relations.provider'
import { User } from '../../model/user.model'
import { Report } from '../../model/report.model'
import { Comment } from '../../model/comment.model'
import { Team } from '../../model/team.model'
import { Organization } from '../../model/organization.model'
import { Relations } from '../../model/relations.model'
import { Relation } from 'src/model/relation.model'

const capitalize = (s) => s && s[0].toUpperCase() + s.slice(1)

const flatten = (list) => list.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), [])

@Injectable()
export class RelationsService {
    constructor(private readonly provider: RelationsMongoProvider) {}

    scanEntityForRelation(data: object) {
        const foreignKeys = Object.keys(data).filter((key) => key.endsWith('_id') || key.endsWith('_ids'))

        const relations = foreignKeys
            .map((key) => {
                const collection = capitalize(key.split('_id')[0])
                return { collection, id: data[key] }
            })
            .filter((item) => item.id !== null)

        return relations
    }

    scanForRelations(list) {
        const relations = flatten(list.map((d) => this.scanEntityForRelation(d)))

        return relations.reduce((grouped, relation) => {
            if (!grouped[relation.collection]) grouped[relation.collection] = []
            grouped[relation.collection].push(relation.id)
            return grouped
        }, {})
    }

    async getRelations(entities: object | [object]): Promise<Relations> {
        if (!Array.isArray(entities)) entities = [entities]

        const groupedRelations = this.scanForRelations(entities)

        const reducer = async (previousPromise, collection: string) => {
            const relations: Relations = await previousPromise
            const models = await this.provider.readFromCollectionByIds(collection, groupedRelations[collection])

            relations[collection.toLowerCase()] = models.reduce((acc, model) => {
                if (collection === 'User') acc[model._id] = model as User
                if (collection === 'Report') acc[model._id] = model as Report
                if (collection === 'Comment') acc[model._id] = model as Comment
                if (collection === 'Team') acc[model._id] = model as Team
                if (collection === 'Organization') acc[model._id] = model as Organization
                return acc
            }, {})

            return relations
        }

        const relations = await Object.keys(groupedRelations).reduce(reducer, {})

        // console.log(relations)

        return relations
    }
}
