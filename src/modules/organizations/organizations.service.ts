import { KysoRole, Organization, OrganizationMember, OrganizationMemberJoin, UpdateOrganizationMembers, User } from '@kyso-io/kyso-model'
import { Injectable, PreconditionFailedException, Provider } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { PlatformRole } from '../../security/platform-roles'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { OrganizationMemberMongoProvider } from './providers/mongo-organization-member.provider'
import { OrganizationsMongoProvider } from './providers/mongo-organizations.provider'

function factory(service: OrganizationsService) {
    return service
}

export function createProvider(): Provider<OrganizationsService> {
    return {
        provide: `${OrganizationsService.name}`,
        useFactory: (service) => factory(service),
        inject: [OrganizationsService],
    }
}

@Injectable()
export class OrganizationsService extends AutowiredService {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    constructor(private readonly provider: OrganizationsMongoProvider, private readonly organizationMemberProvider: OrganizationMemberMongoProvider) {
        super()
    }

    public async getOrganization(query: any): Promise<Organization> {
        const organization = await this.provider.read(query)
        if (organization.length === 0) {
            return null
        }

        return organization[0]
    }

    public async getOrganizationById(id: string): Promise<Organization> {
        return this.getOrganization({ filter: { _id: this.provider.toObjectId(id) } })
    }

    public async createOrganization(organization: Organization): Promise<Organization> {
        // The name of this organization exists?
        const organizations: Organization[] = await this.provider.read({ filter: { name: organization.name } })
        if (organizations.length > 0) {
            throw new PreconditionFailedException('The name of the organization must be unique')
        }
        return this.provider.create(organization)
    }

    public async deleteOrganization(organizationId: string): Promise<boolean> {
        const organization: Organization = await this.getOrganizationById(organizationId)
        if (!organization) {
            throw new PreconditionFailedException('Organization does not exist')
        }

        // Delete all teams of this organization
        await this.teamsService.deleteGivenOrganization(organization.id)

        // Delete all members of this organization
        await this.organizationMemberProvider.deleteMany({ filter: { organization_id: organization.id } })

        // Delete the organization
        await this.provider.deleteOne({ _id: this.provider.toObjectId(organization.id) })

        return true
    }

    public async addMembers(organizationId: string, members: User[], roles: KysoRole[]): Promise<void> {
        const organization: Organization = await this.getOrganizationById(organizationId)
        if (!organization) {
            throw new PreconditionFailedException('Organization does not exist')
        }
        const memberIds: string[] = members.map((x) => x.id.toString())
        const rolesToApply: string[] = roles.map((y) => y.name)
        await this.addMembersById(organization.id, memberIds, rolesToApply)
    }

    public async addMembersById(organizationId: string, memberIds: string[], rolesToApply: string[]): Promise<void> {
        for (const memberId of memberIds) {
            const member: OrganizationMemberJoin = new OrganizationMemberJoin(organizationId, memberId, rolesToApply, true)
            await this.organizationMemberProvider.create(member)
        }
    }

    public async isUserInOrganization(user: User, organization: Organization): Promise<OrganizationMemberJoin[]> {
        return this.searchMembersJoin({ filter: { $and: [{ member_id: user.id }, { organization_id: organization.id }] } })
    }

    public async searchMembersJoin(query: any): Promise<OrganizationMemberJoin[]> {
        return this.organizationMemberProvider.read(query) as Promise<OrganizationMemberJoin[]>
    }

    /**
     * Return an array of user id's that belongs to provided organization
     */
    public async getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
        const organization: Organization = await this.getOrganizationById(organizationId)
        if (organization) {
            // Get all the members of this organization
            const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id)

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

            const users = await this.usersService.getUsers(filter)

            const usersAndRoles = users.map((u: User) => {
                // Find role for this user in members
                const thisMember: OrganizationMemberJoin = members.find((tm: OrganizationMemberJoin) => u.id.toString() === tm.member_id)

                return { ...u, roles: thisMember.role_names }
            })

            return usersAndRoles.map((x) => new OrganizationMember(x.id.toString(), x.nickname, x.username, x.roles, x.bio, x.avatar_url, x.email))
        } else {
            return []
        }
    }

    public async updateOrganization(organizationId: string, organization: Organization): Promise<Organization> {
        const organizationDb: Organization = await this.getOrganizationById(organizationId)
        if (!organization) {
            throw new PreconditionFailedException('Organization does not exist')
        }

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

    public async addMemberToOrganization(organizationId: string, userId: string): Promise<OrganizationMemberJoin> {
        const organization: Organization = await this.getOrganizationById(organizationId)
        if (!organization) {
            throw new PreconditionFailedException('Organization does not exist')
        }
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new PreconditionFailedException('User does not exist')
        }

        const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id)
        const member: OrganizationMemberJoin = members.find((x: OrganizationMemberJoin) => x.member_id === user.id)
        if (member) {
            throw new PreconditionFailedException('User already belongs to the organization')
        }

        const newMember: OrganizationMemberJoin = new OrganizationMemberJoin(organization.id, user.id, [], true)
        return this.organizationMemberProvider.create(newMember)
    }

    public async removeMemberFromOrganization(organizationId: string, userId: string): Promise<boolean> {
        const organization: Organization = await this.getOrganizationById(organizationId)
        if (!organization) {
            throw new PreconditionFailedException('Organization does not exist')
        }

        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new PreconditionFailedException('User does not exist')
        }

        const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id)
        const index: number = members.findIndex((x: OrganizationMemberJoin) => x.member_id === user.id)
        if (index === -1) {
            throw new PreconditionFailedException('User is not a member of this organization')
        }

        await this.organizationMemberProvider.deleteOne({ organization_id: organization.id, member_id: user.id })
        members.splice(index, 1)

        if (members.length === 0) {
            // Organization without members, delete it
            await this.provider.deleteOne({ _id: this.provider.toObjectId(organization.id) })
        }

        return true
    }

    public async updateOrganizationMembersRoles(organizationId: string, data: UpdateOrganizationMembers): Promise<OrganizationMember[]> {
        const organization: Organization = await this.getOrganizationById(organizationId)
        if (!organization) {
            throw new PreconditionFailedException('Organization does not exist')
        }
        const validRoles: string[] = [
            PlatformRole.TEAM_ADMIN_ROLE.name,
            PlatformRole.TEAM_CONTRIBUTOR_ROLE.name,
            PlatformRole.TEAM_READER_ROLE.name,
            PlatformRole.ORGANIZATION_ADMIN_ROLE.name,
            ...organization.roles.map((x: KysoRole) => x.name),
        ]
        const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id)
        for (const element of data.members) {
            const user: User = await this.usersService.getUser({ filter: { username: element.username } })
            if (!user) {
                throw new PreconditionFailedException('User does not exist')
            }
            const member: OrganizationMemberJoin = members.find((x: OrganizationMemberJoin) => x.member_id === user.id)
            if (!member) {
                throw new PreconditionFailedException('User is not a member of this organization')
            }
            const role: string = member.role_names.find((x: string) => x === element.role)
            if (!role) {
                if (!validRoles.includes(element.role)) {
                    throw new PreconditionFailedException(`Role ${element.role} is not valid`)
                }
                await this.organizationMemberProvider.update({ _id: this.provider.toObjectId(member.id) }, { $push: { role_names: element.role } })
            } else {
                throw new PreconditionFailedException('User already has this role')
            }
        }
        return this.getOrganizationMembers(organization.name)
    }

    public async removeOrganizationMemberRole(organizationId: string, userId: string, role: string): Promise<boolean> {
        const organization: Organization = await this.getOrganizationById(organizationId)
        if (!organization) {
            throw new PreconditionFailedException('Organization does not exist')
        }
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new PreconditionFailedException('User does not exist')
        }
        const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id)
        const data: OrganizationMemberJoin = members.find((x: OrganizationMemberJoin) => x.member_id === user.id)
        if (!data) {
            throw new PreconditionFailedException('User is not a member of this organization')
        }
        const index: number = data.role_names.findIndex((x: string) => x === role)
        if (index === -1) {
            throw new PreconditionFailedException(`User does not have role ${role}`)
        }
        await this.organizationMemberProvider.update({ _id: this.provider.toObjectId(data.id) }, { $pull: { role_names: role } })
        return true
    }

    public async getUserOrganizations(userId: string): Promise<Organization[]> {
        const userInOrganizations: OrganizationMemberJoin[] = await this.organizationMemberProvider.read({ filter: { member_id: userId } })
        return this.provider.read({
            filter: { _id: { $in: userInOrganizations.map((x: OrganizationMemberJoin) => this.provider.toObjectId(x.organization_id)) } },
        })
    }
}
