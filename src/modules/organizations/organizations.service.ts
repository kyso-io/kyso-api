import { Injectable, PreconditionFailedException } from '@nestjs/common'
import { usersService } from '../../main'
import { UpdateOrganizationMembers } from '../../model/dto/update-organization-members.dto'
import { KysoRole } from '../../model/kyso-role.model'
import { OrganizationMemberJoin } from '../../model/organization-member-join.model'
import { OrganizationMember } from '../../model/organization-member.model'
import { Organization } from '../../model/organization.model'
import { User } from '../../model/user.model'
import { OrganizationMemberMongoProvider } from './providers/mongo-organization-member.provider'
import { OrganizationsMongoProvider } from './providers/mongo-organizations.provider'

@Injectable()
export class OrganizationsService {
    constructor(private readonly provider: OrganizationsMongoProvider, private readonly organizationMemberProvider: OrganizationMemberMongoProvider) {}

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

            const users = await usersService.getUsers(filter)

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

    public async getMembers(organizationId: string): Promise<OrganizationMemberJoin[]> {
        return this.organizationMemberProvider.getMembers(organizationId)
    }

    public async updateOrganizationMembers(name: string, data: UpdateOrganizationMembers): Promise<OrganizationMember[]> {
        const organization: Organization = await this.getOrganization({ filter: { name } })
        if (!organization) {
            throw new PreconditionFailedException('Organization does not exist')
        }
        const validRoles: string[] = [
            KysoRole.TEAM_ADMIN_ROLE.name,
            KysoRole.TEAM_CONTRIBUTOR_ROLE.name,
            KysoRole.TEAM_READER_ROLE.name,
            KysoRole.ORGANIZATION_ADMIN_ROLE.name,
            ...organization.roles.map((x: KysoRole) => x.name),
        ]
        const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id)
        for (const element of data.members) {
            const member: OrganizationMemberJoin = members.find((x: OrganizationMemberJoin) => x.member_id === element.user_id)
            if (!member) {
                throw new PreconditionFailedException('User is not a member of this organization')
            }
            const role: string = member.role_names.find((x: string) => x === element.role)
            if (!role) {
                if (!validRoles.includes(element.role)) {
                    throw new PreconditionFailedException(`Role ${element.role} is not valid`)
                }
                await this.organizationMemberProvider.update({ _id: this.provider.toObjectId(member.id) }, { $push: { role_names: element.role } })
            }
        }
        return this.getOrganizationMembers(organization.name)
    }

    public async removeOrganizationMember(name: string, member_id: string, role: string): Promise<OrganizationMember[]> {
        const organization: Organization = await this.getOrganization({ filter: { name } })
        if (!organization) {
            throw new PreconditionFailedException('Organization does not exist')
        }
        const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id)
        const data: OrganizationMemberJoin = members.find((x: OrganizationMemberJoin) => x.member_id === member_id)
        if (!data) {
            throw new PreconditionFailedException('User is not a member of this organization')
        }
        const index: number = data.role_names.findIndex((x: string) => x === role)
        if (index === -1) {
            throw new PreconditionFailedException(`User does not have role ${role}`)
        }
        await this.organizationMemberProvider.update({ _id: this.provider.toObjectId(data.id) }, { $pull: { role_names: role } })
        return this.getOrganizationMembers(organization.name)
    }
}
