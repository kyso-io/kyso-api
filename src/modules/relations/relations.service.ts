import { Injectable, Provider } from '@nestjs/common'
import { AutowiredService } from '../../generic/autowired.generic'
import { RelationsMongoProvider } from './providers/mongo-relations.provider'

const capitalize = (s) => s && s[0].toUpperCase() + s.slice(1)

const flatten = (list) => list.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), [])

const listKeyToVal = (data: any) => {
    return data.reduce((prev: any, curr: any) => {
        prev[curr.id] = curr
        return prev
    }, {} as object)
}

function factory(service: RelationsService) {
    return service
}

export function createProvider(): Provider<RelationsService> {
    return {
        provide: `${RelationsService.name}`,
        useFactory: (service) => factory(service),
        inject: [RelationsService],
    }
}

@Injectable()
export class RelationsService extends AutowiredService {
    constructor(private readonly provider: RelationsMongoProvider) {
        super()
    }

    scanEntityForRelation(data: object, mappings: { [key: string]: string }) {
        const foreignKeys = Object.keys(data).filter((key) => key.endsWith('_id') || key.endsWith('_ids'))

        const relations = foreignKeys
            .map((key) => {
                let collection = capitalize(key.split('_id')[0])
                if (mappings.hasOwnProperty(collection)) {
                    collection = mappings[collection]
                }
                return { collection, id: data[key] }
            })
            .filter((item) => item.id !== null && item.id.length > 0)

        const result = []
        relations.forEach((relation) => {
            if (Array.isArray(relation.id)) {
                relation.id.forEach((id) => {
                    result.push({ collection: relation.collection, id })
                })
            } else {
                result.push(relation)
            }
        })
        return result
    }

    scanForRelations(list, mappings: { [key: string]: string }) {
        const relations = flatten(list.map((d) => this.scanEntityForRelation(d, mappings)))
        return relations.reduce((grouped, relation) => {
            if (!grouped[relation.collection]) grouped[relation.collection] = []
            const index: number = grouped[relation.collection].findIndex((item) => item === relation.id)
            if (index === -1) {
                grouped[relation.collection].push(relation.id)
            }
            return grouped
        }, {})
    }

    async getRelations(entities: object | [object], entityType: string, mappings: { [key: string]: string } = {}) {
        if (!Array.isArray(entities)) entities = [entities]

        const groupedRelations = this.scanForRelations(entities, mappings)

        const relations = await Object.keys(groupedRelations).reduce(async (previousPromise, collection) => {
            const accumulator = await previousPromise
            const entities = await this.provider.readFromCollectionByIds(collection, groupedRelations[collection])
            accumulator[collection.toLowerCase()] = entities.reduce((acc, entity) => {
                acc[entity.id] = entity
                return acc
            }, {})
            return accumulator
        }, Promise.resolve({}))

        relations[entityType] = {
            ...relations[entityType],
            ...listKeyToVal(entities),
        }

        return relations
    }
}
