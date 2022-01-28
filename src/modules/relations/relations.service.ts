import { Comment, Organization, Relations, Report, Team, User } from '@kyso-io/kyso-model'
import { Injectable, Provider } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { AutowiredService } from '../../generic/autowired.generic'
import { RelationsMongoProvider } from './providers/mongo-relations.provider'

const capitalize = (s: string) => s && s[0].toUpperCase() + s.slice(1)

const flatten = (list) => list.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), [])

const VALID_COLLECTIONS: string[] = ['User', 'Organization', 'Team', 'Report', 'Comment']

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
        const result: { [collectionName: string]: string[] } = relations.reduce((grouped, relation) => {
            if (!grouped[relation.collection]) grouped[relation.collection] = []
            const index: number = grouped[relation.collection].findIndex((item) => item === relation.id)
            if (index === -1) {
                grouped[relation.collection].push(relation.id)
            }
            return grouped
        }, {})
        const validCollections: { [collectionName: string]: string[] } = {}
        for (const collectionName in result) {
            if (VALID_COLLECTIONS.includes(collectionName)) {
                validCollections[collectionName] = result[collectionName]
            }
        }
        return validCollections
    }

    async getRelations(entities: object | [object], entityType: string, mappings: { [key: string]: string } = {}): Promise<Relations> {
        if (!Array.isArray(entities)) entities = [entities]

        const groupedRelations = this.scanForRelations(entities, mappings)

        const reducer = async (previousPromise, collection: string) => {
            const relations: Relations = await previousPromise
            const models = await this.provider.readFromCollectionByIds(collection, groupedRelations[collection])
            relations[collection.toLowerCase()] = models.reduce((acc, model) => {
                if (!model) {
                    return
                }
                if (collection === 'User') acc[model.id] = plainToInstance(User, model)
                if (collection === 'Report') acc[model.id] = plainToInstance(Report, model)
                if (collection === 'Comment') acc[model.id] = plainToInstance(Comment, model)
                if (collection === 'Team') acc[model.id] = plainToInstance(Team, model)
                if (collection === 'Organization') acc[model.id] = plainToInstance(Organization, model)
                return acc
            }, {})
            return relations
        }

        const relations = await Object.keys(groupedRelations).reduce(reducer, {})
        relations[entityType] = {
            ...relations[entityType],
            ...listKeyToVal(entities),
        }

        return plainToInstance(Relations, await Object.keys(groupedRelations).reduce(reducer, {}))
    }
}
