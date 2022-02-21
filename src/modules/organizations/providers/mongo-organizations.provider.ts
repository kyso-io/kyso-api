import { Organization, OrganizationAuthOptions, OrganizationOptions } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class OrganizationsMongoProvider extends MongoProvider<Organization> {
    version = 2

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

        for(let org of allOrganizations) {
            org.options = orgOptions

            // If options does not exist, set the default value
            if(!org.options) {
                org.options = orgOptions
                
                const data: any = {}
                data.options = orgOptions
                
                Logger.log(`Migrating organization ${org.nickname} from version 1 to version 2`)
                
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
}
