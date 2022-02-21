import { KysoDataModelVersion } from '@kyso-io/kyso-model'
import { Logger } from '@nestjs/common'
import * as mongo from 'mongodb'
import { ObjectId } from 'mongodb'

const FK_NAME_REGEX = /^_p_(_?[a-zA-Z]+)$/
const FK_VALUE_REGEX = RegExp('^_?[a-zA-Z]+\\$(\\w+)$')
const QUERY_TO_PIPELINE = {
    projection: '$project',
    filter: '$match',
    sort: '$sort',
    skip: '$skip',
    limit: '$limit',
}

const KYSO_MODEL_VERSION_COLLECTION_NAME = 'KysoDataModelVersion'
export class MongoProvider<T> {
    baseCollection: any
    private db: any
    private indices: any[]
    // Default version number
    protected version = 1
    protected kysoModelProvider

    constructor(collection, mongoDB, indices?: any[]) {
        this.db = mongoDB
        this.baseCollection = collection
        this.indices = indices || []

        const existsCollectionPromise = this.existsMongoDBCollection(this.baseCollection)

        existsCollectionPromise.then(async (existsCollection) => {
            await this.checkAndCreateKysoModelVersionCollection()
            if (!existsCollection) {
                try {
                    Logger.log(`Collection '${this.baseCollection}' does not exists, creating it`)
                    await this.db.createCollection(this.baseCollection)

                    Logger.log(`Populating minimal data for '${this.baseCollection}' collection`)
                    await this.populateMinimalData()

                    await this.checkIndices()
                    await this.saveModelVersion(this.version)
                } catch (ex) {
                    Logger.log(`Collection '${this.baseCollection}' already exists`, ex)
                }
            } else {
                await this.checkIndices()
                const existsVersion = await this.existsCollectionVersion()

                if (existsVersion) {
                    const databaseVersion: KysoDataModelVersion = await this.getCollectionVersion()
                    const dbVersion = databaseVersion.version

                    if (dbVersion < this.version) {
                        await this.executeMigration(dbVersion, this.version)
                    }
                } else {
                    await this.saveModelVersion(this.version)
                }
            }
        })
    }

    private async checkIndices(): Promise<void> {
        if (this.indices.length === 0) {
            return
        }
        Logger.log(`Checking indices for '${this.baseCollection}' collection`, MongoProvider.name)
        for (const element of this.indices) {
            try {
                await this.getCollection().createIndex(element.keys, element.options)
            } catch (e) {
                Logger.error(`Error checking indices for '${this.baseCollection}' collection`, e, MongoProvider.name)
            }
        }
    }

    // TO OVERRIDE
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    populateMinimalData() {}

    async executeMigration(fromVersion: number, toVersion: number) {
        const callableMigrationMethods = []
        for (let i = fromVersion; i < toVersion; i++) {
            const j = i + 1
            callableMigrationMethods.push(`migrate_from_${i}_to_${j}`)
        }

        for (const x of callableMigrationMethods) {
            try {
                Logger.log('Executing migration ' + x)
                const migrationResult = await this.runDynamicMethod(x)
                // Update migration in database
                await this.saveModelVersion(x.split('_to_')[1] as number)
            } catch (ex) {
                Logger.error(`Migration ${x} returned an error`, ex)
                // Break the loop as the data can be inconsistent
                break
            }
        }
    }

    getCollection(name?) {
        const collectionName = name || this.baseCollection
        return this.db.collection(collectionName)
    }

    static toObjectId(id: string): mongo.ObjectId {
        return new ObjectId(id)
    }

    toObjectId(id: string): mongo.ObjectId {
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
        const a = [
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

        return a
    }

    public async create(obj: any): Promise<any> {
        obj.created_at = new Date()
        await this.getCollection().insertOne(obj)
        obj.id = obj._id.toString()
        await this.update({ _id: obj._id }, { $set: { id: obj._id.toString() } })

        return obj
    }

    public async aggregate(pipeline, collection = '') {
        const cursor = await this.getCollection(collection)
            .aggregate(pipeline)
            .map((elem) => parseForeignKeys(elem))
        return cursor.toArray()
    }

    public async read(query): Promise<T[]> {
        const { filter, ...options } = query
        const cursor = await this.getCollection()
            .find(filter, options)
            .map((elem) => parseForeignKeys(elem))
        return cursor.toArray()
    }

    public async update(filterQuery, updateQuery): Promise<T> {
        if (!updateQuery.$currentDate) updateQuery.$currentDate = {}
        updateQuery.$currentDate.updated_at = { $type: 'date' }

        const obj = await this.getCollection().findOneAndUpdate(filterQuery, updateQuery, { returnDocument: 'after' })

        return parseForeignKeys(obj.value)
    }

    public async updateOne(filterQuery, updateQuery): Promise<T> {
        if (!updateQuery.$currentDate) updateQuery.$currentDate = {}
        updateQuery.$currentDate.updated_at = { $type: 'date' }

        const obj = await this.getCollection().updateOne(filterQuery, updateQuery, { returnDocument: 'after' })

        return parseForeignKeys(obj.value)
    }

    public async deleteOne(filter: any): Promise<void> {
        await this.getCollection().deleteOne(filter)
    }

    public async deleteMany(filter: any): Promise<void> {
        await this.getCollection().deleteMany(filter)
    }

    public async existsMongoDBCollection(name: string): Promise<boolean> {
        const allCollections: any[] = await this.db.listCollections().toArray()
        const found = allCollections.findIndex((item) => {
            return item.name === name
        })

        return found === -1 ? false : true
    }

    private async checkAndCreateKysoModelVersionCollection() {
        if (!(await this.existsMongoDBCollection(KYSO_MODEL_VERSION_COLLECTION_NAME))) {
            try {
                Logger.log(`Collection KysoDataModelVersion does not exists, creating it`)
                await this.db.createCollection(KYSO_MODEL_VERSION_COLLECTION_NAME)
            } catch (ex) {}
        }
    }

    public async count(query): Promise<number> {
        const { filter } = query
        const count = await this.getCollection().countDocuments(filter)
        return count
    }

    runDynamicMethod(methodName: string) {
        this[methodName]()
    }

    protected async getCollectionVersion(): Promise<KysoDataModelVersion> {
        const { filter, ...options } = { filter: { collection: this.baseCollection } }
        const cursor = await this.db
            .collection(KYSO_MODEL_VERSION_COLLECTION_NAME)
            .find(filter, options)
            .map((elem) => parseForeignKeys(elem))
        const databaseCollectionVersion: KysoDataModelVersion[] = await cursor.toArray()

        if (databaseCollectionVersion && databaseCollectionVersion.length === 1) {
            return databaseCollectionVersion[0]
        } else if (databaseCollectionVersion.length > 1) {
            Logger.warn(`Collection ${this.baseCollection} has more than one document in the database`)
            return databaseCollectionVersion[0]
        } else {
            return null
        }
    }

    protected async existsCollectionVersion(): Promise<boolean> {
        const { filter, ...options } = { filter: { collection: this.baseCollection } }
        const cursor = await this.db
            .collection(KYSO_MODEL_VERSION_COLLECTION_NAME)
            .find(filter, options)
            .map((elem) => parseForeignKeys(elem))

        const databaseCollectionVersion: KysoDataModelVersion[] = await cursor.toArray()

        if (databaseCollectionVersion && databaseCollectionVersion.length === 1) {
            return true
        } else if (databaseCollectionVersion.length > 1) {
            Logger.warn(`Collection ${this.baseCollection} has more than one document in the database`)
            return true
        } else {
            return false
        }
    }

    async saveModelVersion(version: number) {
        const { filter, ...options } = { filter: { collection: this.baseCollection } }
        const cursor = await this.db
            .collection(KYSO_MODEL_VERSION_COLLECTION_NAME)
            .find(filter, options)
            .map((elem) => parseForeignKeys(elem))

        const databaseCollectionVersion: any[] = await cursor.toArray()

        if (databaseCollectionVersion && databaseCollectionVersion.length === 1) {
            // Exists, then update
            const data: any = {}
            data.version = version

            await this.db.collection(KYSO_MODEL_VERSION_COLLECTION_NAME).updateOne(
                { collection: this.baseCollection },
                {
                    $set: data,
                    $currentDate: { updated_at: { $type: 'date' } },
                },
                { returnDocument: 'after' },
            )
        } else {
            // Does not exists, then create
            const newKysoDataModelVersion = new KysoDataModelVersion() as any
            newKysoDataModelVersion.collection = this.baseCollection
            newKysoDataModelVersion.version = version
            delete newKysoDataModelVersion._id

            newKysoDataModelVersion.created_at = new Date()
            await this.db.collection(KYSO_MODEL_VERSION_COLLECTION_NAME).insertOne(newKysoDataModelVersion)
        }
    }
}

function parseForeignKeys(obj) {
    if (obj) {
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
                else if (key === 'created_at') result.created_at = value
                else if (key === 'updated_at') result.updated_at = value
                // Exception to the rule, is not a security issue as the hash is unique and can't be dehashed, and we need it
                // to compare it in the login process
                else if (key === '_hashed_password') result.hashed_password = value
                delete result[key]
            } else if (Object.prototype.toString.call(value) === '[object Object]') result[key] = parseForeignKeys(value)
            else if (Array.isArray(value)) result[key] = result[key].map(parseForeignKeys)
        })

        return result
    }
}
