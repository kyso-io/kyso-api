import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
    AddUserOrganizationDto,
    KysoRole,
    KysoSettingsEnum,
    NumMembersAndReportsOrg,
    Organization,
    OrganizationMember,
    OrganizationMemberJoin,
    OrganizationOptions,
    Report,
    Team,
    TeamVisibilityEnum,
    Token,
    UpdateOrganizationDTO,
    UpdateOrganizationMembersDTO,
    User,
} from '@kyso-io/kyso-model'
import { BadRequestException, Injectable, Logger, NotFoundException, PreconditionFailedException, Provider } from '@nestjs/common'
import { extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { PlatformRole } from '../../security/platform-roles'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'
import { ReportsService } from '../reports/reports.service'
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

    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService

    @Autowired({ typeName: 'ReportsService' })
    private reportsService: ReportsService

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
        const organizations: Organization[] = await this.provider.read({ filter: { sluglified_name: organization.sluglified_name } })

        if (organizations.length > 0) {
            let i = organizations.length + 1
            do {
                organization.sluglified_name = `${organization.sluglified_name}-${i}`
                const index: number = organizations.findIndex((org: Organization) => org.sluglified_name === organization.sluglified_name)
                if (index === -1) {
                    break
                }
                i++
            } while (true)
        }

        const newOrganization: Organization = await this.provider.create(organization)

        // Now, create the default teams for that organization
        const generalTeam = new Team(
            'General',
            '',
            'A general team to share information and discuss',
            '',
            '',
            [],
            newOrganization.id,
            TeamVisibilityEnum.PROTECTED,
        )

        await this.teamsService.createTeam(generalTeam)

        return newOrganization
    }

    public async deleteOrganization(organizationId: string): Promise<Organization> {
        const organization: Organization = await this.getOrganizationById(organizationId)
        if (!organization) {
            throw new PreconditionFailedException('Organization does not exist')
        }

        // Delete all teams of this organization
        await this.teamsService.deleteGivenOrganization(organization.id)

        // Delete all members of this organization
        await this.organizationMemberProvider.deleteMany({ organization_id: organization.id })

        // Delete the organization
        await this.provider.deleteOne({ _id: this.provider.toObjectId(organization.id) })

        return organization
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
            const belongs: boolean = await this.userBelongsToOrganization(memberId, organizationId)
            if (belongs) {
                continue
            }
            const member: OrganizationMemberJoin = new OrganizationMemberJoin(organizationId, memberId, rolesToApply, true)
            await this.organizationMemberProvider.create(member)
        }
    }

    public async userBelongsToOrganization(userId: string, organizationId: string): Promise<boolean> {
        const members: OrganizationMemberJoin[] = await this.searchMembersJoin({
            filter: { $and: [{ member_id: userId }, { organization_id: organizationId }] },
        })
        return members.length > 0
    }

    public async searchMembersJoin(query: any): Promise<OrganizationMemberJoin[]> {
        // return this.organizationMemberProvider.read(query)
        const userOrganizationMembership: OrganizationMemberJoin[] = await this.organizationMemberProvider.read(query)
        const map: Map<string, OrganizationMemberJoin> = new Map<string, OrganizationMemberJoin>()
        for (const userOrganizationMember of userOrganizationMembership) {
            const key = `${userOrganizationMember.organization_id}-${userOrganizationMember.member_id}`
            if (map.has(key)) {
                // User is in organization twice
                await this.organizationMemberProvider.deleteOne({ _id: this.provider.toObjectId(userOrganizationMember.id) })
                continue
            }
            map.set(key, userOrganizationMember)
        }
        return Array.from(userOrganizationMembership.values())
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

            return usersAndRoles.map((x) => new OrganizationMember(x.id.toString(), x.display_name, x.name, x.roles, x.bio, x.avatar_url, x.email))
        } else {
            return []
        }
    }

    public async updateOrganizationOptions(organizationId: string, options: OrganizationOptions): Promise<Organization> {
        const organizationDb: Organization = await this.getOrganizationById(organizationId)
        if (!organizationDb) {
            throw new PreconditionFailedException('Organization does not exist')
        }
        return await this.provider.update(
            { _id: this.provider.toObjectId(organizationDb.id) },
            {
                $set: { options },
            },
        )
    }

    public async updateOrganization(organizationId: string, updateOrganizationDTO: UpdateOrganizationDTO): Promise<Organization> {
        const organizationDb: Organization = await this.getOrganizationById(organizationId)
        if (!organizationDb) {
            throw new PreconditionFailedException('Organization does not exist')
        }
        const data: any = {}
        if (updateOrganizationDTO.location) {
            data.location = updateOrganizationDTO.location
        }
        if (updateOrganizationDTO.link) {
            data.link = updateOrganizationDTO.link
        }
        if (updateOrganizationDTO.bio) {
            data.bio = updateOrganizationDTO.bio
        }
        if (updateOrganizationDTO.allowed_access_domains) {
            data.allowed_access_domains = updateOrganizationDTO.allowed_access_domains
        }
        return await this.provider.update(
            { _id: this.provider.toObjectId(organizationDb.id) },
            {
                $set: data,
            },
        )
    }

    public async getMembers(organizationId: string): Promise<OrganizationMemberJoin[]> {
        return this.organizationMemberProvider.getMembers(organizationId)
    }

    public async addMemberToOrganization(addUserOrganizationDto: AddUserOrganizationDto): Promise<OrganizationMember[]> {
        const organization: Organization = await this.getOrganizationById(addUserOrganizationDto.organizationId)
        if (!organization) {
            throw new PreconditionFailedException('Organization does not exist')
        }
        const user: User = await this.usersService.getUserById(addUserOrganizationDto.userId)
        if (!user) {
            throw new PreconditionFailedException('User does not exist')
        }
        const validRoles: string[] = [
            PlatformRole.TEAM_ADMIN_ROLE.name,
            PlatformRole.TEAM_CONTRIBUTOR_ROLE.name,
            PlatformRole.TEAM_READER_ROLE.name,
            PlatformRole.ORGANIZATION_ADMIN_ROLE.name,
            ...organization.roles.map((x: KysoRole) => x.name),
        ]
        if (!validRoles.includes(addUserOrganizationDto.role)) {
            throw new PreconditionFailedException('Invalid role')
        }
        const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id)
        let member: OrganizationMemberJoin = members.find((x: OrganizationMemberJoin) => x.member_id === user.id)
        if (member) {
            // Check if member has the role
            if (!member.role_names.includes(addUserOrganizationDto.role)) {
                member.role_names.push(addUserOrganizationDto.role)
                await this.organizationMemberProvider.updateOne({ _id: this.provider.toObjectId(member.id) }, { role_names: member.role_names })
            }
        } else {
            const newMember: OrganizationMemberJoin = new OrganizationMemberJoin(organization.id, user.id, [addUserOrganizationDto.role], true)
            await this.organizationMemberProvider.create(newMember)
        }
        return this.getOrganizationMembers(organization.id)
    }

    public async addUserToOrganization(userId: string, organizationName: string, invitationCode: string): Promise<boolean> {
        const organization: Organization = await this.getOrganization({
            filter: {
                sluglified_name: organizationName,
            },
        })
        if (!organization) {
            throw new NotFoundException('Organization does not exist')
        }
        if (organization.invitation_code !== invitationCode) {
            throw new BadRequestException('Invalid invitation code')
        }
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new NotFoundException('User does not exist')
        }
        const role: string = PlatformRole.TEAM_READER_ROLE.name
        const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id)
        let member: OrganizationMemberJoin = members.find((x: OrganizationMemberJoin) => x.member_id === user.id)
        if (!member) {
            const newMember: OrganizationMemberJoin = new OrganizationMemberJoin(organization.id, user.id, [role], true)
            await this.organizationMemberProvider.create(newMember)
        }
        return true
    }

    public async removeMemberFromOrganization(organizationId: string, userId: string): Promise<OrganizationMember[]> {
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

        return this.getOrganizationMembers(organization.id)
    }

    public async UpdateOrganizationMembersDTORoles(organizationId: string, data: UpdateOrganizationMembersDTO): Promise<OrganizationMember[]> {
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
            const user: User = await this.usersService.getUserById(element.userId)
            if (!user) {
                throw new PreconditionFailedException('User does not exist')
            }
            const member: OrganizationMemberJoin = members.find((x: OrganizationMemberJoin) => x.member_id === user.id)
            if (!member) {
                throw new PreconditionFailedException('User is not a member of this organization')
            }
            if (!validRoles.includes(element.role)) {
                throw new PreconditionFailedException(`Role ${element.role} is not valid`)
            }
            await this.organizationMemberProvider.update({ _id: this.provider.toObjectId(member.id) }, { $set: { role_names: [element.role] } })
        }
        return this.getOrganizationMembers(organization.id)
    }

    public async removeOrganizationMemberRole(organizationId: string, userId: string, role: string): Promise<OrganizationMember[]> {
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
        return this.getOrganizationMembers(organization.id)
    }

    public async getUserOrganizations(userId: string): Promise<Organization[]> {
        const userInOrganizations: OrganizationMemberJoin[] = await this.organizationMemberProvider.read({ filter: { member_id: userId } })
        return this.provider.read({
            filter: { _id: { $in: userInOrganizations.map((x: OrganizationMemberJoin) => this.provider.toObjectId(x.organization_id)) } },
        })
    }

    private async getS3Client(): Promise<S3Client> {
        const awsRegion = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_REGION)
        const awsAccessKey = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_ACCESS_KEY_ID)
        const awsSecretAccessKey = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_SECRET_ACCESS_KEY)

        return new S3Client({
            region: awsRegion,
            credentials: {
                accessKeyId: awsAccessKey,
                secretAccessKey: awsSecretAccessKey,
            },
        })
    }

    public async setProfilePicture(organizationId: string, file: any): Promise<Organization> {
        const organization: Organization = await this.getOrganizationById(organizationId)
        const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)

        if (!organization) {
            throw new PreconditionFailedException('Organization not found')
        }
        const s3Client: S3Client = await this.getS3Client()
        if (organization?.avatar_url && organization.avatar_url.length > 0) {
            Logger.log(`Removing previous image of organization ${organization.sluglified_name}`, OrganizationsService.name)
            const deleteObjectCommand: DeleteObjectCommand = new DeleteObjectCommand({
                Bucket: s3Bucket,
                Key: organization.avatar_url.split('/').slice(-1)[0],
            })
            await s3Client.send(deleteObjectCommand)
        }
        Logger.log(`Uploading image for organization ${organization.sluglified_name}`, OrganizationsService.name)
        const Key = `${uuidv4()}${extname(file.originalname)}`
        await s3Client.send(
            new PutObjectCommand({
                Bucket: s3Bucket,
                Key,
                Body: file.buffer,
            }),
        )
        Logger.log(`Uploaded image for organization ${organization.sluglified_name}`, OrganizationsService.name)
        const avatar_url = `https://${s3Bucket}.s3.amazonaws.com/${Key}`
        return this.provider.update({ _id: this.provider.toObjectId(organization.id) }, { $set: { avatar_url } })
    }

    public async deleteProfilePicture(organizationId: string): Promise<Organization> {
        const organization: Organization = await this.getOrganizationById(organizationId)
        const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)

        if (!organization) {
            throw new PreconditionFailedException('Organization not found')
        }
        const s3Client: S3Client = await this.getS3Client()
        if (organization?.avatar_url && organization.avatar_url.length > 0) {
            Logger.log(`Removing previous image of organization ${organization.sluglified_name}`, OrganizationsService.name)
            const deleteObjectCommand: DeleteObjectCommand = new DeleteObjectCommand({
                Bucket: s3Bucket,
                Key: organization.avatar_url.split('/').slice(-1)[0],
            })
            await s3Client.send(deleteObjectCommand)
        }
        return this.provider.update({ _id: this.provider.toObjectId(organization.id) }, { $set: { avatar_url: null } })
    }

    public async getNumMembersAndReportsByOrganization(token: Token, organizationId: string): Promise<NumMembersAndReportsOrg[]> {
        const map: Map<string, { members: number; reports: number }> = new Map<string, { members: number; reports: number }>()
        const query: any = {
            filter: {},
        }
        if (!token.isGlobalAdmin()) {
            query.filter.member_id = token.id
        }
        if (organizationId && organizationId.length > 0) {
            query.filter.organization_id = organizationId
        }
        const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.read(query)
        members.forEach((organizationMemberJoin: OrganizationMemberJoin) => {
            if (!map.has(organizationMemberJoin.organization_id)) {
                map.set(organizationMemberJoin.organization_id, { members: 0, reports: 0 })
            }
            map.get(organizationMemberJoin.organization_id).members++
        })
        const teamOrgMap: Map<string, string> = new Map<string, string>()
        let teams: Team[] = []
        const teamsQuery: any = {
            filter: {},
        }
        const reportsQuery: any = {
            filter: {},
        }
        if (organizationId && organizationId.length > 0) {
            teamsQuery.filter.organization_id = organizationId
        }
        if (token.isGlobalAdmin()) {
            teams = await this.teamsService.getTeams(teamsQuery)
        } else {
            teams = await this.teamsService.getTeamsForController(token.id, teamsQuery)
            reportsQuery.filter = {
                team_id: {
                    $in: teams.map((x: Team) => x.id),
                },
            }
        }
        teams.forEach((team: Team) => {
            teamOrgMap.set(team.id, team.organization_id)
        })
        const reports: Report[] = await this.reportsService.getReports(reportsQuery)
        reports.forEach((report: Report) => {
            const organizationId: string | undefined = teamOrgMap.get(report.team_id)
            if (!organizationId) {
                return
            }
            if (!map.has(organizationId)) {
                map.set(organizationId, { members: 0, reports: 0 })
            }
            map.get(organizationId).reports++
        })
        const result: NumMembersAndReportsOrg[] = []
        map.forEach((value: { members: number; reports: number }, organizationId: string) => {
            result.push({
                organization_id: organizationId,
                members: value.members,
                reports: value.reports,
            })
        })
        return result
    }
}
