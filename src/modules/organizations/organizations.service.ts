import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
    AddUserOrganizationDto,
    Comment,
    CreateOrganizationDto,
    Discussion,
    InviteUserDto,
    KysoEventEnum,
    KysoOrganizationsAddMemberEvent,
    KysoOrganizationsCreateEvent,
    KysoOrganizationsDeleteEvent,
    KysoOrganizationsRemoveMemberEvent,
    KysoOrganizationsUpdateEvent,
    KysoRole,
    KysoSettingsEnum,
    Organization,
    OrganizationInfoDto,
    OrganizationMember,
    OrganizationMemberJoin,
    OrganizationOptions,
    OrganizationPermissionsEnum,
    OrganizationStorageDto,
    PaginatedResponseDto,
    Report,
    ReportDTO,
    ResourcePermissions,
    SignUpDto,
    StorageDto,
    Team,
    TeamMember,
    TeamVisibilityEnum,
    Token,
    UpdateOrganizationDTO,
    UpdateOrganizationMembersDTO,
    User,
} from '@kyso-io/kyso-model'
import {
    BadRequestException,
    ForbiddenException,
    Inject,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    PreconditionFailedException,
    Provider,
} from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import axios, { AxiosResponse } from 'axios'
import * as moment from 'moment'
import { extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { NATSHelper } from '../../helpers/natsHelper'
import slugify from '../../helpers/slugify'
import { PlatformRole } from '../../security/platform-roles'
import { CommentsService } from '../comments/comments.service'
import { DiscussionsService } from '../discussions/discussions.service'
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

    @Autowired({ typeName: 'CommentsService' })
    private commentsService: CommentsService

    @Autowired({ typeName: 'DiscussionsService' })
    private discussionsService: DiscussionsService

    constructor(
        private readonly provider: OrganizationsMongoProvider,
        private readonly organizationMemberProvider: OrganizationMemberMongoProvider,
        @Inject('NATS_SERVICE') private client: ClientProxy,
    ) {
        super()
    }

    public async getOrganizations(query: any): Promise<Organization[]> {
        return await this.provider.read(query)
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

    public async getOrganizationBySlugName(organizationSlug: string): Promise<Organization> {
        return this.getOrganization({
            filter: {
                sluglified_name: organizationSlug,
            },
        })
    }

    public async createOrganization(token: Token, createOrganizationDto: CreateOrganizationDto): Promise<Organization> {
        const numOrganizationsCreatedByUser: number = await this.provider.count({ filter: { user_id: token.id } })
        const value: number = parseInt(await this.kysoSettingsService.getValue(KysoSettingsEnum.MAX_ORGANIZATIONS_PER_USER), 10)
        if (numOrganizationsCreatedByUser >= value) {
            throw new ForbiddenException('You have reached the maximum number of organizations you can create')
        }

        const organization: Organization = new Organization(
            createOrganizationDto.display_name,
            createOrganizationDto.display_name,
            [],
            [],
            token.email,
            '',
            '',
            false,
            createOrganizationDto.location,
            createOrganizationDto.link,
            createOrganizationDto.bio,
            '',
            uuidv4(),
            token.id,
        )

        // The name of this organization exists?
        const organizations: Organization[] = await this.provider.read({ filter: { display_name: organization.display_name } })

        if (organizations.length > 0) {
            let i = organizations.length + 1
            do {
                const candidate_sluglified_name = `${organization.sluglified_name}-${i}`
                const index: number = organizations.findIndex((org: Organization) => org.sluglified_name === candidate_sluglified_name)
                if (index === -1) {
                    organization.sluglified_name = candidate_sluglified_name
                    break
                }
                i++
            } while (true)
        }

        organization.user_id = token.id
        const newOrganization: Organization = await this.provider.create(organization)

        // Add user to his organization
        await this.addMembersById(newOrganization.id, [token.id], [PlatformRole.ORGANIZATION_ADMIN_ROLE.name])

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
            token.id,
        )
        await this.teamsService.createTeam(token, generalTeam)

        NATSHelper.safelyEmit<KysoOrganizationsCreateEvent>(this.client, KysoEventEnum.ORGANIZATIONS_CREATE, {
            user: await this.usersService.getUserById(token.id),
            organization: newOrganization,
        })

        return newOrganization
    }

    public async deleteOrganization(token: Token, organizationId: string): Promise<Organization> {
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

        NATSHelper.safelyEmit<KysoOrganizationsDeleteEvent>(this.client, KysoEventEnum.ORGANIZATIONS_DELETE, {
            user: await this.usersService.getUserById(token.id),
            organization,
        })

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

            if (filterArray.length > 0) {
                const filter = { filter: { $or: filterArray } }

                const users = await this.usersService.getUsers(filter)

                const usersAndRoles = users.map((u: User) => {
                    // Find role for this user in members
                    const thisMember: OrganizationMemberJoin = members.find((tm: OrganizationMemberJoin) => u.id.toString() === tm.member_id)

                    return { ...u, roles: thisMember.role_names }
                })

                return usersAndRoles.map((x) => new OrganizationMember(x.id.toString(), x.display_name, x.username, x.roles, x.bio, x.avatar_url, x.email))
            } else {
                return []
            }
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

    public async updateOrganization(token: Token, organizationId: string, updateOrganizationDTO: UpdateOrganizationDTO): Promise<Organization> {
        let organizationDb: Organization = await this.getOrganizationById(organizationId)
        if (!organizationDb) {
            throw new PreconditionFailedException('Organization does not exist')
        }
        const data: any = {}
        if (updateOrganizationDTO.hasOwnProperty('location')) {
            data.location = updateOrganizationDTO.location
        }
        if (updateOrganizationDTO.hasOwnProperty('link')) {
            data.link = updateOrganizationDTO.link
        }
        if (updateOrganizationDTO.hasOwnProperty('bio')) {
            data.bio = updateOrganizationDTO.bio
        }
        if (updateOrganizationDTO.hasOwnProperty('allowed_access_domains')) {
            data.allowed_access_domains = updateOrganizationDTO.allowed_access_domains
        }
        organizationDb = await this.provider.update(
            { _id: this.provider.toObjectId(organizationDb.id) },
            {
                $set: data,
            },
        )

        NATSHelper.safelyEmit<KysoOrganizationsUpdateEvent>(this.client, KysoEventEnum.ORGANIZATIONS_UPDATE, {
            user: await this.usersService.getUserById(token.id),
            organization: organizationDb,
        })

        return organizationDb
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
        let sendNotifications: boolean = false
        const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id)
        let member: OrganizationMemberJoin = members.find((x: OrganizationMemberJoin) => x.member_id === user.id)
        if (member) {
            // Check if member has the role
            if (!member.role_names.includes(addUserOrganizationDto.role)) {
                member.role_names.push(addUserOrganizationDto.role)
                await this.organizationMemberProvider.updateOne({ _id: this.provider.toObjectId(member.id) }, { $set: { role_names: [member.role_names] } })
            }
        } else {
            const newMember: OrganizationMemberJoin = new OrganizationMemberJoin(organization.id, user.id, [addUserOrganizationDto.role], true)
            await this.organizationMemberProvider.create(newMember)
            sendNotifications = true
        }

        // SEND NOTIFICATIONS
        if (sendNotifications) {
            try {
                const isCentralized: boolean = organization?.options?.notifications?.centralized || false
                const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)
                let emailsCentralized: string[] = []
                if (isCentralized) {
                    emailsCentralized = organization.options.notifications.emails
                }
                NATSHelper.safelyEmit<KysoOrganizationsAddMemberEvent>(this.client, KysoEventEnum.ORGANIZATIONS_ADD_MEMBER, {
                    user,
                    organization,
                    emailsCentralized,
                    role: addUserOrganizationDto.role,
                    frontendUrl,
                })
            } catch (ex) {
                Logger.error('Error sending notifications of new member in an organization', ex)
            }
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

        // SEND NOTIFICATIONS
        const isCentralized: boolean = organization?.options?.notifications?.centralized || false
        const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)
        let emailsCentralized: string[] = []
        if (isCentralized) {
            emailsCentralized = organization.options.notifications.emails
        }
        NATSHelper.safelyEmit<KysoOrganizationsAddMemberEvent>(this.client, KysoEventEnum.ORGANIZATIONS_ADD_MEMBER, {
            user,
            organization,
            emailsCentralized,
            role,
            frontendUrl,
        })

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
        await this.teamsService.deleteMemberInTeamsOfOrganization(organization.id, user.id)

        // SEND NOTIFICATIONS
        const isCentralized: boolean = organization?.options?.notifications?.centralized || false
        const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)
        let emailsCentralized: string[] = []
        if (isCentralized) {
            emailsCentralized = organization.options.notifications.emails
        }
        NATSHelper.safelyEmit<KysoOrganizationsRemoveMemberEvent>(this.client, KysoEventEnum.ORGANIZATIONS_REMOVE_MEMBER, {
            user,
            organization,
            emailsCentralized,
            frontendUrl,
        })

        return this.getOrganizationMembers(organization.id)
    }

    public async UpdateOrganizationMembersDTORoles(organizationId: string, data: UpdateOrganizationMembersDTO): Promise<OrganizationMember[]> {
        const organization: Organization = await this.getOrganizationById(organizationId)
        if (!organization) {
            throw new PreconditionFailedException('Organization does not exist')
        }
        const isCentralized: boolean = organization?.options?.notifications?.centralized || false
        const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)
        let emailsCentralized: string[] = []
        if (isCentralized) {
            emailsCentralized = organization.options.notifications.emails
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
            if (!member.role_names.includes(element.role)) {
                NATSHelper.safelyEmit<KysoOrganizationsAddMemberEvent>(this.client, KysoEventEnum.ORGANIZATIONS_UPDATE_MEMBER_ROLE, {
                    user,
                    organization,
                    emailsCentralized,
                    role: element.role,
                    frontendUrl,
                })
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

    public async getNumMembersAndReportsByOrganization(token: Token | null, organizationId: string): Promise<OrganizationInfoDto[]> {
        const map: Map<string, { members: number; reports: number; discussions: number; comments: number; lastChange: Date; avatar_url: string }> = new Map<
            string,
            { members: number; reports: number; discussions: number; comments: number; lastChange: Date; avatar_url: string }
        >()
        const query: any = {
            filter: {},
        }
        if (token && !token.isGlobalAdmin()) {
            query.filter.member_id = token.id
        }
        if (organizationId && organizationId.length > 0) {
            query.filter.organization_id = organizationId
        }
        const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.read(query)
        for (const organizationMemberJoin of members) {
            if (!map.has(organizationMemberJoin.organization_id)) {
                const organization: Organization = await this.getOrganizationById(organizationMemberJoin.organization_id)
                const members: OrganizationMember[] = await this.getOrganizationMembers(organization.id)
                map.set(organization.id, {
                    members: members.length,
                    reports: 0,
                    discussions: 0,
                    comments: 0,
                    lastChange: organization.updated_at,
                    avatar_url: organization.avatar_url,
                })
            }
        }
        const teamOrgMap: Map<string, string> = new Map<string, string>()
        let teams: Team[] = []
        const teamsQuery: any = {
            filter: {},
        }
        const reportsQuery: any = {
            filter: {},
        }
        const discussionsQuery: any = {
            filter: {
                mark_delete_at: null,
            },
        }
        if (organizationId && organizationId.length > 0) {
            teamsQuery.filter.organization_id = organizationId
        }
        if (!token) {
            if (organizationId) {
                teamsQuery.filter.organization_id = organizationId
            }
            teamsQuery.filter.visibility = TeamVisibilityEnum.PUBLIC
            teams = await this.teamsService.getTeams(teamsQuery)
            if (teams.length > 0) {
                reportsQuery.filter = {
                    team_id: {
                        $in: teams.map((x: Team) => x.id),
                    },
                }
                discussionsQuery.filter = {
                    team_id: {
                        $in: teams.map((x: Team) => x.id),
                    },
                }
            } else {
                reportsQuery.filter = null
            }
        } else if (token.isGlobalAdmin()) {
            teams = await this.teamsService.getTeams(teamsQuery)
        } else {
            teams = await this.teamsService.getTeamsForController(token.id, teamsQuery)
            if (teams.length > 0) {
                reportsQuery.filter = {
                    team_id: {
                        $in: teams.map((x: Team) => x.id),
                    },
                }
                discussionsQuery.filter = {
                    team_id: {
                        $in: teams.map((x: Team) => x.id),
                    },
                }
            } else {
                reportsQuery.filter = null
            }
        }
        teams.forEach((team: Team) => {
            teamOrgMap.set(team.id, team.organization_id)
            if (map.has(team.organization_id)) {
                map.get(team.organization_id).lastChange = moment.max(moment(team.updated_at), moment(map.get(team.organization_id).lastChange)).toDate()
            }
        })
        const reports: Report[] = reportsQuery.filter ? await this.reportsService.getReports(reportsQuery) : []
        const mapReportOrg: Map<string, string> = new Map<string, string>()
        reports.forEach((report: Report) => {
            const organizationId: string | undefined = teamOrgMap.get(report.team_id)
            if (!organizationId) {
                return
            }
            mapReportOrg.set(report.id, organizationId)
            if (!map.has(organizationId)) {
                map.set(organizationId, { members: 0, reports: 0, discussions: 0, comments: 0, lastChange: moment('1970-01-10').toDate(), avatar_url: null })
            }
            map.get(organizationId).reports++
            map.get(organizationId).lastChange = moment.max(moment(report.updated_at), moment(map.get(organizationId).lastChange)).toDate()
        })
        const discussions: Discussion[] = discussionsQuery.filter ? await this.discussionsService.getDiscussions(discussionsQuery) : []
        const mapDiscussionOrg: Map<string, string> = new Map<string, string>()
        discussions.forEach((discussion: Discussion) => {
            const organizationId: string | undefined = teamOrgMap.get(discussion.team_id)
            if (!organizationId) {
                return
            }
            mapDiscussionOrg.set(discussion.id, organizationId)
            if (!map.has(organizationId)) {
                map.set(organizationId, {
                    members: 0,
                    reports: 0,
                    discussions: 0,
                    comments: 0,
                    lastChange: moment('1970-01-10').toDate(),
                    avatar_url: null,
                })
            }
            map.get(organizationId).discussions++
            map.get(organizationId).lastChange = moment.max(moment(discussion.updated_at), moment(map.get(organizationId).lastChange)).toDate()
        })
        const commentsQuery: any = {
            filter: {},
        }
        if (!token || !token.isGlobalAdmin()) {
            commentsQuery.filter = {
                $or: [],
            }
            if (reports.length > 0) {
                commentsQuery.filter.$or.push({
                    report_id: { $in: reports.map((report: Report) => report.id) },
                })
            }
            if (discussions.length > 0) {
                commentsQuery.filter.$or.push({
                    discussion_id: { $in: discussions.map((discussion: Discussion) => discussion.id) },
                })
            }
            if (reports.length === 0 && discussions.length === 0) {
                commentsQuery.filter = null
            }
        }
        const comments: Comment[] = commentsQuery.filter ? await this.commentsService.getComments(commentsQuery) : []
        comments.forEach((comment: Comment) => {
            let organizationId: string | null
            if (comment.report_id) {
                organizationId = mapReportOrg.get(comment.report_id)
            } else if (comment.discussion_id) {
                organizationId = mapReportOrg.get(comment.discussion_id)
            }
            if (!organizationId) {
                return
            }
            if (!map.has(organizationId)) {
                map.set(organizationId, {
                    members: 0,
                    reports: 0,
                    discussions: 0,
                    comments: 0,
                    lastChange: moment('1970-01-10').toDate(),
                    avatar_url: null,
                })
            }
            map.get(organizationId).comments++
            map.get(organizationId).lastChange = moment.max(moment(comment.updated_at), moment(map.get(organizationId).lastChange)).toDate()
        })
        const result: OrganizationInfoDto[] = []
        map.forEach(
            (
                value: { members: number; reports: number; discussions: number; comments: number; lastChange: Date; avatar_url: string },
                organizationId: string,
            ) => {
                result.push({
                    organization_id: organizationId,
                    members: value.members,
                    reports: value.reports,
                    discussions: value.discussions,
                    comments: value.comments,
                    lastChange: value.lastChange,
                    avatar_url: value.avatar_url,
                })
            },
        )
        return result
    }

    public async getOrganizationStorage(user: Token, sluglified_name: string): Promise<OrganizationStorageDto> {
        const organization: Organization = await this.getOrganization({ filter: { sluglified_name } })
        if (!organization) {
            Logger.log(`Organization ${sluglified_name} not found`)
            throw new NotFoundException(`Organization ${sluglified_name} not found`)
        }
        let isOrgAdmin: boolean = false
        if (!user.isGlobalAdmin()) {
            const resourcePermissionOrg: ResourcePermissions = user.permissions.organizations.find((x: ResourcePermissions) => x.id === organization.id)
            if (resourcePermissionOrg) {
                isOrgAdmin = resourcePermissionOrg.role_names.indexOf(PlatformRole.ORGANIZATION_ADMIN_ROLE.name) > -1
            }
        }
        const resourcePermissionTeams: ResourcePermissions[] = user.permissions.teams.filter(
            (x: ResourcePermissions) => x.organization_id === organization.id && x.role_names.indexOf(PlatformRole.TEAM_ADMIN_ROLE.name) > -1,
        )

        let data: OrganizationStorageDto
        try {
            const kysoIndexerApi: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.KYSO_INDEXER_API_BASE_URL)
            const url = `${kysoIndexerApi}/api/storage?organizationFolderPath=/sftp/data/scs/${sluglified_name}`

            Logger.log(`Calling ${url}`)
            const axiosResponse: AxiosResponse<OrganizationStorageDto> = await axios.get<OrganizationStorageDto>(url)
            data = axiosResponse.data
        } catch (e: any) {
            Logger.error('Unexpected error', e)
            throw new InternalServerErrorException(e.message)
        }

        const organizationStorageDto: OrganizationStorageDto = new OrganizationStorageDto()
        organizationStorageDto.name = sluglified_name
        for (const storageTeam of data.teams) {
            const indexTeam: number = resourcePermissionTeams.findIndex((x: ResourcePermissions) => x.name === storageTeam.name)
            if (user.isGlobalAdmin() || isOrgAdmin || indexTeam > -1) {
                organizationStorageDto.teams.push(storageTeam)
            }
        }
        organizationStorageDto.consumedSpaceKb = organizationStorageDto.teams.reduce((acc: number, cur: StorageDto) => acc + cur.consumedSpaceKb, 0)
        organizationStorageDto.consumedSpaceMb = organizationStorageDto.teams.reduce((acc: number, cur: StorageDto) => acc + cur.consumedSpaceMb, 0)
        organizationStorageDto.consumedSpaceGb = organizationStorageDto.teams.reduce((acc: number, cur: StorageDto) => acc + cur.consumedSpaceGb, 0)

        return organizationStorageDto
    }

    public async getOrganizationReports(
        token: Token,
        organizationSlug: string,
        page: number,
        limit: number,
        sort: string,
    ): Promise<PaginatedResponseDto<ReportDTO>> {
        const organization: Organization = await this.getOrganization({ filter: { sluglified_name: organizationSlug } })
        if (!organization) {
            Logger.log(`Organization ${organizationSlug} not found`)
            throw new NotFoundException(`Organization ${organizationSlug} not found`)
        }
        let teams: Team[] = []
        if (token) {
            teams = await this.teamsService.getTeamsVisibleForUser(token.id)
            if (teams.length > 0) {
                teams = teams.filter((x: Team) => x.organization_id === organization.id)
            } else {
                teams = await this.teamsService.getTeams({ filter: { organization_id: organization.id, visibility: TeamVisibilityEnum.PUBLIC } })
            }
        } else {
            teams = await this.teamsService.getTeams({ filter: { organization_id: organization.id, visibility: TeamVisibilityEnum.PUBLIC } })
        }
        const query: any = {
            filter: {
                team_id: { $in: teams.map((x: Team) => x.id) },
            },
        }
        const totalItems: number = await this.reportsService.countReports(query)

        query.limit = limit
        query.skip = (page - 1) * limit
        query.sort = {
            pin: -1,
            created_at: -1,
        }
        if (sort) {
            let key: string = sort
            let value: number = 1
            if (sort.indexOf('-') === 0) {
                key = sort.substring(1)
                value = -1
            }
            query.sort[key] = value
        }

        const totalPages: number = Math.ceil(totalItems / limit)
        const reports: Report[] = await this.reportsService.getReports(query)
        const results: ReportDTO[] = await Promise.all(reports.map((report: Report) => this.reportsService.reportModelToReportDTO(report, token?.id)))
        return {
            currentPage: page,
            itemCount: results.length,
            itemsPerPage: Math.min(query.limit, results.length),
            results,
            totalItems,
            totalPages,
        }
    }

    public async inviteNewUser(token: Token, inviteUserDto: InviteUserDto): Promise<{ organizationMembers: OrganizationMember[]; teamMembers: TeamMember[] }> {
        const organization: Organization = await this.getOrganization({ filter: { sluglified_name: inviteUserDto.organizationSlug } })
        if (!organization) {
            Logger.log(`Organization ${inviteUserDto.organizationSlug} not found`)
            throw new NotFoundException(`Organization ${inviteUserDto.organizationSlug} not found`)
        }
        const permissionOrg: ResourcePermissions | undefined = token.permissions.organizations.find((x: ResourcePermissions) => x.id === organization.id)
        if (!permissionOrg) {
            Logger.log(`User ${token.id} is not authorized to invite users to organization ${inviteUserDto.organizationSlug}`)
            throw new ForbiddenException(`User ${token.id} is not authorized to invite users to organization ${inviteUserDto.organizationSlug}`)
        }

        if (!inviteUserDto.teamSlug) {
            const isOrgAdmin: boolean = permissionOrg.permissions.includes(OrganizationPermissionsEnum.ADMIN)
            if (!token.isGlobalAdmin() && !isOrgAdmin) {
                Logger.log(`User ${token.id} is not authorized to invite users to organization ${inviteUserDto.organizationSlug}`)
                throw new ForbiddenException(`User ${token.id} is not authorized to invite users to organization ${inviteUserDto.organizationSlug}`)
            }
        }

        let user: User = await this.usersService.getUser({ filter: { email: inviteUserDto.email } })
        if (user) {
            Logger.log(`User ${inviteUserDto.email} already exists`)
            throw new BadRequestException(`User ${inviteUserDto.email} already exists`)
        }
        const signUpDto: SignUpDto = new SignUpDto()
        signUpDto.email = inviteUserDto.email
        signUpDto.username = inviteUserDto.email
        signUpDto.display_name = inviteUserDto.email
        signUpDto.password = uuidv4()
        user = await this.usersService.createUser(signUpDto)

        await this.addMembersById(organization.id, [user.id], [inviteUserDto.organizationRole])

        const result: { organizationMembers: OrganizationMember[]; teamMembers: TeamMember[] } = {
            organizationMembers: await this.getOrganizationMembers(organization.id),
            teamMembers: [],
        }

        if (inviteUserDto?.teamSlug) {
            const team: Team = await this.teamsService.getTeam({ filter: { organization_id: organization.id, sluglified_name: inviteUserDto.teamSlug } })
            if (!team) {
                Logger.log(`Team ${inviteUserDto.teamSlug} not found`)
                throw new NotFoundException(`Team ${inviteUserDto.teamSlug} not found`)
            }
            await this.teamsService.addMembersById(team.id, [user.id], [inviteUserDto.teamRole])
            result.teamMembers = await this.teamsService.getMembers(team.id)
        }

        return result
    }
}
