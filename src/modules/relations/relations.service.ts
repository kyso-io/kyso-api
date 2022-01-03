import { Injectable } from '@nestjs/common'
import { RelationsMongoProvider } from './providers/mongo-relations.provider'

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
        const relations = flatten(list.map(d => this.scanEntityForRelation(d)))

        return relations.reduce((grouped, relation) => {
            if (!grouped[relation.collection]) grouped[relation.collection] = []
            grouped[relation.collection].push(relation.id)
            return grouped
        }, {})
    }

    async getRelations(entities: object | [object]) {

        if (!Array.isArray(entities)) entities = [entities]

        const groupedRelations = this.scanForRelations(entities)

        return await Object.keys(groupedRelations).reduce(async (previousPromise, collection) => {
            const accumulator = await previousPromise
            const entities = await this.provider.readFromCollectionByIds(collection, groupedRelations[collection])
            accumulator[collection.toLowerCase()] = entities
            return accumulator
        }, Promise.resolve({}))
    }
}
