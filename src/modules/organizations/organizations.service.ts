import { forwardRef, Inject, Injectable, PreconditionFailedException } from '@nestjs/common'
import { KysoRole } from '../../model/kyso-role.model'
import { OrganizationMemberJoin } from '../../model/organization-member-join.model'
import { OrganizationMember } from '../../model/organization-member.model'
import { Organization } from '../../model/organization.model'
import { User } from '../../model/user.model'
import { UsersService } from '../users/users.service'
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
        const organizations: Organization[] = await this.provider.read({ filter: { name: organizationName } })

        if (organizations.length > 0) {
            // Get all the members of this organization
            const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organizations[0].id)

            // Build query object to retrieve all the users
            const user_ids = members.map((x: OrganizationMemberJoin) => {
                return x.member_id
            })

            // Build the query to retrieve all the users
            const filterArray = []
            user_ids.forEach((id: string) => {
                filterArray.push({ _id: this.provider.toObjectId(id) })
            })

            const filter = { filter: { $or: filterArray } }

            const users = await this.userService.getUsers(filter)

            const usersAndRoles = users.map((u: User) => {
                // Find role for this user in members
                const thisMember: OrganizationMemberJoin = members.find((tm: OrganizationMemberJoin) => u.id.toString() === tm.member_id)

                return { ...u, roles: thisMember.role_names }
            })

            const toFinalObject = usersAndRoles.map((x) => {
                const obj: OrganizationMember = new OrganizationMember()

                obj.avatar_url = x.avatar_url
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

    public async updateOrganization(name: string, organization: Organization): Promise<Organization> {
        const organizations: Organization[] = await this.provider.read({ filter: { name } })
        if (organizations.length === 0) {
            throw new PreconditionFailedException('Organization does not exist')
        }

        const organizationDb: Organization = organizations[0]
        if (organizationDb.name !== organization.name) {
            const existsAnotherOrganization: Organization[] = await this.provider.read({ filter: { name: organization.name } })
            if (existsAnotherOrganization.length > 0) {
                throw new PreconditionFailedException('Already exists an organization with this name')
            }
            organizationDb.name = organization.name
        }

        organizationDb.roles = organization.roles
        organizationDb.billingEmail = organization.billingEmail
        organizationDb.allowGoogleLogin = organization.allowGoogleLogin

        return await this.provider.update({ _id: this.provider.toObjectId(organizationDb.id) }, { $set: organizationDb })
    }
}
