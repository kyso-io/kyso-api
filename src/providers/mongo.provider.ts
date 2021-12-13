import { Logger } from "@nestjs/common"

const { MongoClient, ObjectId } = require('mongodb')

const FK_NAME_REGEX = /^_p_(_?[a-zA-Z]+)$/
const FK_VALUE_REGEX = RegExp('^_?[a-zA-Z]+\\$(\\w+)$')
const QUERY_TO_PIPELINE = {
    projection: '$project',
    filter: '$match',
    sort: '$sort',
    skip: '$skip',
    limit: '$limit',
}

export abstract class MongoProvider {
    baseCollection: any
    private db: any
    
    constructor(collection, mongoDB) {
        this.db = mongoDB
        this.baseCollection = collection
        
        const existsCollection = this.existsMongoDBCollection(this.baseCollection)

        if(!existsCollection) {
            Logger.log(`Collection ${this.baseCollection} does not exists, creating it`)
            Logger.log(`Populating minimal data for ${this.baseCollection} collection`)

            this.populateMinimalData()
        }
    }

    abstract populateMinimalData()

    getCollection(name?) {
        const collectionName = name || this.baseCollection
        return this.db.collection(collectionName)
    }

    parseId(id) {
        return new ObjectId(id)
    }

    static aggregationRename(query) {
        const pipeline = {}
        Object.keys(QUERY_TO_PIPELINE).forEach((key) => {
            const newKey = QUERY_TO_PIPELINE[key]
            if (query[key]) pipeline[key] = { [newKey]: query[key] }
        })

        return pipeline
    }

    static joinStage(field, from, as) {
        return [
            {
                $addFields: {
                    [as]: {
                        $arrayElemAt: [{ $split: [`$${field}`, `${from}$`] }, 1],
                    },
                },
            },
            {
                $lookup: {
                    from,
                    localField: as,
                    foreignField: '_id',
                    as,
                },
            },
        ]
    }
    
    async create(obj) {
        obj._created_at = new Date()
        await this.getCollection().insertOne(obj)

        return obj
    }

    async aggregate(pipeline, collection = '') {
        const cursor = await this.getCollection(collection)
            .aggregate(pipeline)
            .map((elem) => parseForeignKeys(elem))
        return cursor.toArray()
    }

    async read(query) {
        const { filter, ...options } = query
        const cursor = await this.getCollection()
            .find(filter, options)
            .map((elem) => parseForeignKeys(elem))
        return cursor.toArray()
    }

    async update(filterQuery, updateQuery) {
        if (!updateQuery.$currentDate) updateQuery.$currentDate = {}
        updateQuery.$currentDate._updated_at = { $type: 'date' }

        const obj = await this.getCollection().findOneAndUpdate(filterQuery, updateQuery, { returnOriginal: false })

        return parseForeignKeys(obj.value)
    }

    async delete(filter) {
        await this.getCollection().deleteOne(filter)
    }

    async existsMongoDBCollection(name: string) {
        return (await (await this.db.listCollections().toArray()).findIndex((item) => item.name === name) !== -1)
    }
}

function parseForeignKeys(obj) {
    const result = obj

    Object.entries(obj).forEach(([key, value]) => {
        let match = FK_NAME_REGEX.exec(key)
        if (match) {
            match = FK_VALUE_REGEX.exec(value as string)
            if (match) {
                const id = match[1]
                result[key] = id
            }
        } else if (key.startsWith('_')) {
            if (key === '_id') result.id = value.toString()
            else if (key === '_created_at') result.created_at = value
            else if (key === '_updated_at') result.updated_at = value
            // Exception to the rule, is not a security issue as the hash is unique and can't be dehashed, and we need it
            // to compare it in the login process
            else if (key === '_hashed_password') result.hashed_password = value
            delete result[key]
        } else if (Object.prototype.toString.call(value) === '[object Object]') result[key] = parseForeignKeys(value)
        else if (Array.isArray(value)) result[key] = result[key].map(parseForeignKeys)
    })

    return result
}


