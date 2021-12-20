import { forwardRef, Inject, Injectable, PreconditionFailedException } from '@nestjs/common'
import { NotFoundError } from 'src/helpers/errorHandling'
import { Organization } from 'src/model/organization.model'
import { User } from 'src/model/user.model'
import { KysoRole } from '../../model/kyso-role.model'
import { UsersService } from '../users/users.service'
import { OrganizationMemberJoin } from '../../model/organization-member-join.model'
import { OrganizationMemberMongoProvider } from './providers/mongo-organization-member.provider'
import { OrganizationsMongoProvider } from './providers/mongo-organizations.provider'
import { OrganizationMember } from 'src/model/organization-member.model'

@Injectable()
export class OrganizationsService {
    constructor(
        private readonly provider: OrganizationsMongoProvider,
        private readonly organizationMemberProvider: OrganizationMemberMongoProvider,
        @Inject(forwardRef(() => UsersService))
        private readonly userService: UsersService,
    ) {}

    async getOrganization(query: any): Promise<Organization> {
        const organization = await this.provider.read(query)
        if (organization.length === 0) {
            return null
        }

        return organization[0]
    }

    async createOrganization(organization: Organization): Promise<Organization> {
        // The name of this organization exists?
        const exists: any[] = await this.provider.read({ filter: { name: organization.name } })

        if (exists.length > 0) {
            // Exists, throw an exception
            throw new PreconditionFailedException('The name of the organization must be unique')
        } else {
            return await this.provider.create(organization)
        }
    }

    async addMembers(organizationName: string, members: User[], roles: KysoRole[]) {
        const organization: Organization = await this.getOrganization({ filter: { name: organizationName } })
        const memberIds = members.map((x) => x.id.toString())
        const rolesToApply = roles.map((y) => y.name)

        await this.addMembersById(organization.id, memberIds, rolesToApply)
    }

    async addMembersById(organizationId: string, memberIds: string[], rolesToApply: string[]) {
        memberIds.forEach(async (userId: string) => {
            const member: OrganizationMemberJoin = new OrganizationMemberJoin(organizationId, userId, rolesToApply, true)

            await this.organizationMemberProvider.create(member)
        })
    }

    async isUserInOrganization(user: User, organization: Organization) {
        const res = await this.searchMembersJoin({ filter: { $and: [{ member_id: user.id }, { organization_id: organization.id }] } })

        return res
    }

    async searchMembersJoin(query: any): Promise<OrganizationMemberJoin[]> {
        return this.organizationMemberProvider.read(query) as Promise<OrganizationMemberJoin[]>
    }

    /**
     * Return an array of user id's that belongs to provided organization
     */
    async getOrganizationMembers(organizationName: string): Promise<OrganizationMember[]> {
        const organization: Organization[] = await this.provider.read({ filter: { name: organizationName } })

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
                const thisMember: OrganizationMemberJoin = members.find((tm: OrganizationMemberJoin) => u.id.toString() === tm.member_id)

                return { ...u, roles: thisMember.role_names }
            })

            const toFinalObject = usersAndRoles.map((x) => {
                let obj: OrganizationMember = new OrganizationMember()

                obj.avatar_url = x.avatarUrl
                obj.bio = x.bio
                obj.id = x.id.toString()
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
