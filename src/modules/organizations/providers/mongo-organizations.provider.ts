import { Organization, OrganizationAuthOptions, OrganizationOptions } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import slug from '../../../helpers/slugify'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class OrganizationsMongoProvider extends MongoProvider<Organization> {
    version = 4

    constructor() {
        super('Organization', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }

    /**
     * Added a new field in organizations in version 2 which adds authentication options. So to upgrade from 1 to 2 we should:
     *     - Iterate through all the existing organizations
     *     - Update it adding the property options with the following structure
     *          options: {
     *              "auth" : {
     *                  "allow_login_with_kyso" : true,
     *                  "allow_login_with_google" : true,
     *                  "allow_login_with_github" : true,
     *                  "otherProviders" : [ ]
     *              }
     *          }
     */
    async migrate_from_1_to_2() {
        const allOrganizations: Organization[] = await this.read({})

        const orgOptions = new OrganizationOptions()
        const orgAuthOptions = new OrganizationAuthOptions()
        orgAuthOptions.allow_login_with_github = true
        orgAuthOptions.allow_login_with_kyso = true
        orgAuthOptions.allow_login_with_google = true
        orgAuthOptions.otherProviders = []
        orgOptions.auth = orgAuthOptions

        for (let org of allOrganizations) {
            org.options = orgOptions

            // If options does not exist, set the default value
            if (!org.options) {
                org.options = orgOptions

                const data: any = {}
                data.options = orgOptions

                Logger.log(`Migrating organization ${org.display_name} from version 1 to version 2`)

                // Add the default value
                await this.update(
                    { _id: this.toObjectId(org.id) },
                    {
                        $set: data,
                    },
                )
            }
        }

        // Update database to new version
        await this.saveModelVersion(2)
    }

    /**
     * Refactored properties:
     *     - nickname to display_name
     *     - name to sluglified_name
     *
     * This migration do:
     *     - Iterates through every document in Organization collection
     *     - For each of them:
     *         - Read nickname and name properties
     *         - Updates new display_name with nickname value
     *         - Updates new sluglified_name with name value, but sluglifing it
     *         - Updates name value as well but sluglifing it
     *
     * This migration DOES NOT DELETE name nor nickname, to be backwards compatible, but these properties are deprecated and will be deleted in next migrations
     */
    async migrate_from_2_to_3() {
        const cursor = await this.getCollection().find({})
        const allOrganizations: any[] = await cursor.toArray()

        for (let organization of allOrganizations) {
            const data: any = {
                sluglified_name: slug(organization.name),
                name: slug(organization.name),
                display_name: organization.nickname,
            }

            await this.update(
                { _id: this.toObjectId(organization.id) },
                {
                    $set: data,
                },
            )
        }

        // This is made automatically, so don't need to add it explicitly
        // await this.saveModelVersion(3)
    }

    public async migrate_from_3_to_4() {
        const cursor = await this.getCollection().find({})
        const allOrganizations: any[] = await cursor.toArray()
        for (let organization of allOrganizations) {
            const data: any = {
                invitation_code: uuidv4(),
            }
            await this.update(
                { _id: this.toObjectId(organization.id) },
                {
                    $set: data,
                },
            )
        }
    }
}
