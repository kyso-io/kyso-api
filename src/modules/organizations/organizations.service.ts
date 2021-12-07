import { forwardRef, Inject, Injectable, PreconditionFailedException } from '@nestjs/common'
import { NotFoundError } from 'src/helpers/errorHandling'
import { Organization } from 'src/model/organization.model'
import { User } from 'src/model/user.model'
import { UsersService } from '../users/users.service'
import { CreateOrganizationRequest } from './model/create-organization-request.model'
import { OrganizationMemberJoin } from './model/organization-member-join.model'
import { OrganizationMember } from './model/organization-member.model copy'
import { OrganizationMemberMongoProvider } from './providers/mongo-organization-member.provider'
import { OrganizationsMongoProvider } from './providers/mongo-organizations.provider'

@Injectable()
export class OrganizationsService {
    constructor(
        private readonly provider: OrganizationsMongoProvider,
        private readonly organizationMemberProvider: OrganizationMemberMongoProvider,
        @Inject(forwardRef(() => UsersService))
        private readonly userService: UsersService,
    ) {}

    async getOrganization(query: any): Promise<Organization> {
        const teams = await this.provider.read(query)
        if (teams.length === 0)
            throw new NotFoundError({
                message: "The specified organization couldn't be found",
            })
        return teams[0]
    }

    async createOrganization(organization: CreateOrganizationRequest): Promise<Organization> {
        let newOrg = new Organization()

        newOrg.name = organization.name
        newOrg.roles = organization.roles

        // The name of this organization exists?
        const exists: any[] = await this.provider.read({ filter: { name: newOrg.name } })

        if (exists.length > 0) {
            // Exists, throw an exception
            throw new PreconditionFailedException('The name of the organization must be unique')
        } else {
            return this.provider.create(newOrg)
        }
    }

    async searchMembersJoin(query: any): Promise<OrganizationMemberJoin[]> {
        return this.organizationMemberProvider.read(query) as Promise<OrganizationMemberJoin[]>
    }

    /**
     * Return an array of user id's that belongs to provided organization
     */
    async getOrganizationMembers(organizationName: string): Promise<OrganizationMember[]> {
        const organization: Organization = await this.provider.read({ filter: { name: organizationName } })

        if (organization) {
            // Get all the members of this organization
            const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization[0].id)

            // Build query object to retrieve all the users
            const user_ids = members.map((x: OrganizationMemberJoin) => {
                return x.member_id
            })

            // Build the query to retrieve all the users
            let filterArray = []
            user_ids.forEach((id: string) => {
                filterArray.push({ _id: id })
            })

            let filter = { filter: { $or: filterArray } }

            let users = await this.userService.getUsers(filter)

            let usersAndRoles = users.map((u: User) => {
                // Find role for this user in members
                const thisMember: OrganizationMemberJoin = members.find((tm: OrganizationMemberJoin) => u.id === tm.member_id)

                return { ...u, roles: thisMember.role_names }
            })

            const toFinalObject = usersAndRoles.map((x) => {
                let obj: OrganizationMember = new OrganizationMember()

                obj.avatar_url = x.avatarUrl
                obj.bio = x.bio
                obj.id = x.id
                obj.nickname = x.nickname
                obj.organization_roles = x.roles
                obj.username = x.username
                obj.email = x.email

                return obj
            })

            return toFinalObject
        } else {
            return []
        }
    }
}
