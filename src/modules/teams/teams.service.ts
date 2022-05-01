import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
    GlobalPermissionsEnum,
    KysoRole,
    KysoSettingsEnum,
    Organization,
    OrganizationMemberJoin,
    Report,
    ReportPermissionsEnum,
    Team,
    TeamMember,
    TeamMemberJoin,
    TeamVisibilityEnum,
    Token,
    UpdateTeamMembersDTO,
    User,
} from '@kyso-io/kyso-model'
import { Injectable, Logger, PreconditionFailedException, Provider } from '@nestjs/common'
import { extname, join } from 'path'
import * as Client from 'ssh2-sftp-client'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { userHasPermission } from '../../helpers/permissions'
import slugify from '../../helpers/slugify'
import { PlatformRole } from '../../security/platform-roles'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { ReportsService } from '../reports/reports.service'
import { SftpService } from '../reports/sftp.service'
import { UsersService } from '../users/users.service'
import { TeamMemberMongoProvider } from './providers/mongo-team-member.provider'
import { TeamsMongoProvider } from './providers/mongo-teams.provider'

function factory(service: TeamsService) {
    return service
}

export function createProvider(): Provider<TeamsService> {
    return {
        provide: `${TeamsService.name}`,
        useFactory: (service) => factory(service),
        inject: [TeamsService],
    }
}

@Injectable()
export class TeamsService extends AutowiredService {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    @Autowired({ typeName: 'ReportsService' })
    private reportsService: ReportsService

    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService

    @Autowired({ typeName: 'SftpService' })
    private sftpService: SftpService

    constructor(private readonly provider: TeamsMongoProvider, private readonly teamMemberProvider: TeamMemberMongoProvider) {
        super()
    }

    public async getTeamById(id: string): Promise<Team> {
        return this.getTeam({ filter: { _id: this.provider.toObjectId(id) } })
    }

    async getTeam(query: any): Promise<Team> {
        const teams = await this.provider.read(query)
        if (teams.length === 0) {
            return null
        }
        return teams[0]
    }

    async getTeams(query): Promise<Team[]> {
        return await this.provider.read(query)
    }

    /**
     * Get all teams that are visible for the specified user
     *
     * @param user
     */
    public async getTeamsVisibleForUser(userId: string): Promise<Team[]> {
        // All public teams
        const userTeamsResult: Team[] = await this.getTeams({ filter: { visibility: TeamVisibilityEnum.PUBLIC } })

        // All protected teams from organizations that the user belongs
        const allUserOrganizations: OrganizationMemberJoin[] = await this.organizationsService.searchMembersJoin({ filter: { member_id: userId } })

        for (const organizationMembership of allUserOrganizations) {
            const result = await this.getTeams({
                filter: {
                    organization_id: organizationMembership.organization_id,
                    visibility: TeamVisibilityEnum.PROTECTED,
                },
            })

            userTeamsResult.push(...result)
        }

        // All teams (whenever is public, private or protected) in which user is member
        const members: TeamMemberJoin[] = await this.searchMembers({ filter: { member_id: userId } })

        for (const m of members) {
            const result = await this.getTeam({ filter: { _id: this.provider.toObjectId(m.team_id) } })
            if (result) {
                userTeamsResult.push(result)
            }
        }

        return [...new Set(userTeamsResult.filter((team) => !!team))]
    }

    public async getTeamsForController(userId: string, query: any): Promise<Team[]> {
        const teams: Team[] = await this.getTeams(query)
        const validMap: Map<string, boolean> = new Map<string, boolean>()
        teams.forEach((team: Team) => {
            if (team.visibility === TeamVisibilityEnum.PUBLIC) {
                validMap.set(team.id, true)
            }
        })
        // All protected teams from organizations that the user belongs
        const filterOrganizationMembers: any = {
            member_id: userId,
        }
        if (query.filter?.organization_id && query.filter.organization_id.length > 0) {
            filterOrganizationMembers.organization_id = query.filter.organization_id
        }
        const allUserOrganizations: OrganizationMemberJoin[] = await this.organizationsService.searchMembersJoin({ filter: filterOrganizationMembers })
        for (const organizationMembership of allUserOrganizations) {
            const result: Team[] = await this.getTeams({
                filter: {
                    organization_id: organizationMembership.organization_id,
                    visibility: TeamVisibilityEnum.PROTECTED,
                },
            })
            result.forEach((team: Team) => {
                validMap.set(team.id, true)
            })
        }
        // All teams (whenever is public, private or protected) in which user is member
        const members: TeamMemberJoin[] = await this.searchMembers({ filter: { member_id: userId } })
        for (const m of members) {
            const filterTeam: any = {
                _id: this.provider.toObjectId(m.team_id),
            }
            if (query.filter?.organization_id && query.filter.organization_id.length > 0) {
                filterTeam.organization_id = query.filter.organization_id
            }
            const result: Team = await this.getTeam({ filter: filterTeam })
            if (result) {
                validMap.set(result.id, true)
            }
        }
        return teams.filter((team: Team) => validMap.has(team.id))
    }

    async searchMembers(query: any): Promise<TeamMemberJoin[]> {
        // return this.teamMemberProvider.read(query)
        const userTeamMembership: TeamMemberJoin[] = await this.teamMemberProvider.read(query)
        const map: Map<string, TeamMemberJoin> = new Map<string, TeamMemberJoin>()
        for (const userTeam of userTeamMembership) {
            const key = `${userTeam.team_id}-${userTeam.member_id}`
            if (map.has(key)) {
                // User is in team twice
                await this.teamMemberProvider.deleteOne({ _id: this.provider.toObjectId(userTeam.id) })
                continue
            }
            map.set(key, userTeam)
        }
        return Array.from(userTeamMembership.values())
    }

    async addMembers(teamName: string, members: User[], roles: KysoRole[]) {
        const team: Team = await this.getTeam({ filter: { name: teamName } })
        const memberIds = members.map((x) => x.id.toString())
        const rolesToApply = roles.map((y) => y.name)

        await this.addMembersById(team.id, memberIds, rolesToApply)
    }

    async addMembersById(teamId: string, memberIds: string[], rolesToApply: string[]): Promise<void> {
        for (const userId of memberIds) {
            const belongs: boolean = await this.userBelongsToTeam(teamId, userId)
            if (belongs) {
                continue
            }
            const member: TeamMemberJoin = new TeamMemberJoin(teamId, userId, rolesToApply, true)
            await this.teamMemberProvider.create(member)
        }
    }

    public async getMembers(teamId: string): Promise<TeamMember[]> {
        const team: Team = await this.getTeamById(teamId)
        if (team) {
            // Get all the members of this team
            const members: TeamMemberJoin[] = await this.teamMemberProvider.getMembers(team.id)

            // Build query object to retrieve all the users
            const user_ids: string[] = members.map((x: TeamMemberJoin) => {
                return x.member_id
            })

            // Build the query to retrieve all the users
            const filterArray = user_ids.map((id: string) => ({ _id: this.provider.toObjectId(id) }))

            if (filterArray.length === 0) {
                return []
            }

            const filter = { filter: { $or: filterArray } }

            const users = await this.usersService.getUsers(filter)

            const usersAndRoles = users.map((u: User) => {
                // Find role for this user in members
                const thisMember: TeamMemberJoin = members.find((tm: TeamMemberJoin) => u.id.toString() === tm.member_id)

                return { ...u, roles: thisMember.role_names }
            })

            return usersAndRoles.map((x) => new TeamMember(x.id.toString(), x.display_name, x.name, x.roles, x.bio, x.avatar_url, x.email))
        } else {
            return []
        }
    }

    public async getAssignees(teamId: string): Promise<TeamMember[]> {
        const team: Team = await this.getTeamById(teamId)
        if (team) {
            let userIds: string[] = []
            let teamMembersJoin: TeamMemberJoin[] = []
            let users: User[] = []
            let organizationMembersJoin: OrganizationMemberJoin[] = []
            switch (team.visibility) {
                case TeamVisibilityEnum.PRIVATE:
                    teamMembersJoin = await this.teamMemberProvider.getMembers(team.id)
                    userIds = teamMembersJoin.map((x: TeamMemberJoin) => x.member_id)
                    break
                case TeamVisibilityEnum.PROTECTED:
                    teamMembersJoin = await this.teamMemberProvider.getMembers(team.id)
                    userIds = teamMembersJoin.map((x: TeamMemberJoin) => x.member_id)
                    organizationMembersJoin = await this.organizationsService.getMembers(team.organization_id)
                    for (const element of organizationMembersJoin) {
                        const index: number = userIds.indexOf(element.member_id)
                        if (index === -1) {
                            userIds.push(element.member_id)
                        }
                    }
                    break
                case TeamVisibilityEnum.PUBLIC:
                    organizationMembersJoin = await this.organizationsService.getMembers(team.organization_id)
                    userIds = organizationMembersJoin.map((x: OrganizationMemberJoin) => x.member_id)
                    const restOfUsers: User[] = await this.usersService.getUsers({
                        filter: { _id: { $nin: organizationMembersJoin.map((x: OrganizationMemberJoin) => x.member_id) } },
                        projection: { _id: 1 },
                    })
                    for (const userId of restOfUsers) {
                        userIds.push(userId.id)
                    }
                    break
            }
            if (userIds.length === 0) {
                return []
            }
            users = await this.usersService.getUsers({
                filter: { _id: { $in: userIds.map((userId: string) => this.provider.toObjectId(userId)) } },
            })
            // Sort users based on the order of userIds
            users.sort((userA: User, userB: User) => {
                return userIds.indexOf(userA.id) - userIds.indexOf(userB.id)
            })
            return users.map((user: User) => {
                return new TeamMember(user.id.toString(), user.display_name, user.name, [], user.bio, user.avatar_url, user.email)
            })
        } else {
            return []
        }
    }

    async updateTeam(filterQuery: any, updateQuery: any): Promise<Team> {
        return this.provider.update(filterQuery, updateQuery)
    }

    async createTeam(team: Team, userId?: string) {
        try {
            team.sluglified_name = slugify(team.display_name)

            // The name of this team exists in the organization?
            const teams: Team[] = await this.provider.read({ filter: { sluglified_name: team.sluglified_name, organization_id: team.organization_id } })

            if (teams.length > 0) {
                let i = teams.length + 1
                do {
                    team.sluglified_name = `${team.sluglified_name}-${i}`
                    const index: number = teams.findIndex((t: Team) => t.sluglified_name === team.sluglified_name)
                    if (index === -1) {
                        break
                    }
                    i++
                } while (true)
            }

            const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
            if (!organization) {
                throw new PreconditionFailedException('The organization does not exist')
            }

            const users: User[] = await this.usersService.getUsers({ filter: { sluglified_name: team.sluglified_name } })
            if (users.length > 0) {
                throw new PreconditionFailedException('There is already a user with this sluglified_name')
            }

            const newTeam: Team = await this.provider.create(team)
            if (userId) {
                await this.addMembersById(newTeam.id, [userId], [PlatformRole.TEAM_ADMIN_ROLE.name])
            }
            return newTeam
        } catch (e) {
            console.log(e)
        }
    }

    public async getReportsOfTeam(token: Token, teamId: string): Promise<Report[]> {
        const team: Team = await this.getTeamById(teamId)
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        const reports: Report[] = await this.reportsService.getReports({ filter: { team_id: team.id } })
        const userTeams: Team[] = await this.getTeamsVisibleForUser(token.id)
        const userInTeam: boolean = userTeams.find((x) => x.id === team.id) !== undefined
        const members: OrganizationMemberJoin[] = await this.organizationsService.getMembers(team.organization_id)
        const userBelongsToOrganization: boolean = members.find((x: OrganizationMemberJoin) => x.member_id === token.id) !== undefined
        const hasGlobalPermissionAdmin: boolean = userHasPermission(token, GlobalPermissionsEnum.GLOBAL_ADMIN)
        if (team.visibility === TeamVisibilityEnum.PUBLIC) {
            if (!userInTeam && !userBelongsToOrganization && !hasGlobalPermissionAdmin) {
                throw new PreconditionFailedException('You are not a member of this team and not of the organization')
            }
            return reports
        } else if (team.visibility === TeamVisibilityEnum.PROTECTED) {
            if (!userInTeam && !userBelongsToOrganization) {
                throw new PreconditionFailedException('You are not a member of this team and not of the organization')
            }
            const userHasReportPermissionRead: boolean = userHasPermission(token, ReportPermissionsEnum.READ)
            const userHasReportPermissionAdmin: boolean = userHasPermission(token, ReportPermissionsEnum.ADMIN)
            if (!userHasReportPermissionRead && !userHasReportPermissionAdmin && !hasGlobalPermissionAdmin && !userBelongsToOrganization) {
                throw new PreconditionFailedException('User does not have permission to read reports')
            }
            return reports
        } else if (team.visibility === TeamVisibilityEnum.PRIVATE) {
            if (!hasGlobalPermissionAdmin && !userInTeam) {
                throw new PreconditionFailedException('You are not a member of this team')
            }
            const userHasReportPermissionRead: boolean = userHasPermission(token, ReportPermissionsEnum.READ)
            const userHasReportPermissionAdmin: boolean = userHasPermission(token, ReportPermissionsEnum.ADMIN)
            if (!userHasReportPermissionRead && !userHasReportPermissionAdmin && !hasGlobalPermissionAdmin) {
                throw new PreconditionFailedException('User does not have permission to read reports')
            }
            return reports
        }
        return []
    }

    public async deleteGivenOrganization(organization_id: string): Promise<void> {
        // Get all team  of the organization
        const teams: Team[] = await this.getTeams({ filter: { organization_id } })
        for (const team of teams) {
            // Delete all members of this team
            await this.teamMemberProvider.deleteMany({ team_id: team.id })
            // Delete team
            await this.provider.deleteOne({ filter: { _id: this.provider.toObjectId(team.id) } })
        }
    }

    public async getUserTeams(user_id: string): Promise<Team[]> {
        const userInTeams: TeamMemberJoin[] = await this.teamMemberProvider.read({ filter: { member_id: user_id } })
        return this.provider.read({ filter: { _id: { $in: userInTeams.map((x) => this.provider.toObjectId(x.team_id)) } } })
    }

    public async userBelongsToTeam(teamId: string, userId: string): Promise<boolean> {
        const team: Team = await this.getTeamById(teamId)
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }

        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new PreconditionFailedException('User not found')
        }

        const members: TeamMember[] = await this.getMembers(team.id)
        const index: number = members.findIndex((member: TeamMember) => member.id === user.id)
        return index !== -1
    }

    public async addMemberToTeam(teamId: string, userId: string): Promise<TeamMember[]> {
        const userBelongsToTeam = await this.userBelongsToTeam(teamId, userId)
        if (userBelongsToTeam) {
            throw new PreconditionFailedException('User already belongs to this team')
        }
        const team: Team = await this.getTeam({
            filter: { name: teamId },
        })
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new PreconditionFailedException('User not found')
        }
        await this.addMembersById(team.id, [user.id], [])
        return this.getMembers(teamId)
    }

    public async removeMemberFromTeam(teamId: string, userId: string): Promise<TeamMember[]> {
        const team: Team = await this.getTeamById(teamId)
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }

        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new PreconditionFailedException('User not found')
        }

        const members: TeamMemberJoin[] = await this.teamMemberProvider.read({ filter: { team_id: team.id } })
        const index: number = members.findIndex((x) => x.member_id === user.id)
        if (index === -1) {
            throw new PreconditionFailedException('User is not a member of this team')
        }

        await this.teamMemberProvider.deleteOne({ team_id: team.id, member_id: user.id })
        members.splice(index, 1)

        if (members.length === 0) {
            // Team without members, delete it
            await this.provider.deleteOne({ _id: this.provider.toObjectId(team.id) })
        }

        return this.getMembers(team.id)
    }

    public async updateTeamMembersDTORoles(teamId: string, data: UpdateTeamMembersDTO): Promise<TeamMember[]> {
        const team: Team = await this.getTeamById(teamId)
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        // const validRoles: string[] = team.roles.map((role: KysoRole) => role.name)
        const members: TeamMemberJoin[] = await this.teamMemberProvider.getMembers(team.id)
        for (const element of data.members) {
            const user: User = await this.usersService.getUserById(element.userId)
            if (!user) {
                throw new PreconditionFailedException('User does not exist')
            }
            const member: TeamMemberJoin = members.find((x: TeamMemberJoin) => x.member_id === user.id)
            if (!member) {
                throw new PreconditionFailedException('User is not a member of this team')
            }
            await this.teamMemberProvider.update({ _id: this.provider.toObjectId(member.id) }, { $set: { role_names: [element.role] } })
        }
        return this.getMembers(team.id)
    }

    public async removeTeamMemberRole(teamId: string, userId: string, role: string): Promise<TeamMember[]> {
        const team: Team = await this.getTeamById(teamId)
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new PreconditionFailedException('User does not exist')
        }
        const members: TeamMemberJoin[] = await this.teamMemberProvider.getMembers(team.id)
        const member: TeamMemberJoin = members.find((x: TeamMemberJoin) => x.member_id === user.id)
        if (!member) {
            throw new PreconditionFailedException('User is not a member of this team')
        }
        const index: number = member.role_names.findIndex((x: string) => x === role)
        if (index === -1) {
            throw new PreconditionFailedException('User does not have this role')
        }
        await this.teamMemberProvider.update({ _id: this.provider.toObjectId(member.id) }, { $pull: { role_names: role } })
        return this.getMembers(userId)
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

    public async setProfilePicture(teamId: string, file: any): Promise<Team> {
        const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)
        const team: Team = await this.getTeamById(teamId)
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        const s3Client: S3Client = await this.getS3Client()
        if (team?.avatar_url && team.avatar_url.length > 0) {
            Logger.log(`Removing previous image of team ${team.sluglified_name}`, OrganizationsService.name)
            const deleteObjectCommand: DeleteObjectCommand = new DeleteObjectCommand({
                Bucket: s3Bucket,
                Key: team.avatar_url.split('/').slice(-1)[0],
            })
            await s3Client.send(deleteObjectCommand)
        }
        Logger.log(`Uploading image for team ${team.sluglified_name}`, OrganizationsService.name)
        const Key = `${uuidv4()}${extname(file.originalname)}`
        await s3Client.send(
            new PutObjectCommand({
                Bucket: s3Bucket,
                Key,
                Body: file.buffer,
            }),
        )
        Logger.log(`Uploaded image for team ${team.sluglified_name}`, OrganizationsService.name)
        const avatar_url = `https://${s3Bucket}.s3.amazonaws.com/${Key}`
        return this.provider.update({ _id: this.provider.toObjectId(team.id) }, { $set: { avatar_url } })
    }

    public async deleteProfilePicture(teamId: string): Promise<Team> {
        const team: Team = await this.getTeamById(teamId)
        const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)

        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        const s3Client: S3Client = await this.getS3Client()
        if (team?.avatar_url && team.avatar_url.length > 0) {
            Logger.log(`Removing previous image of team ${team.sluglified_name}`, OrganizationsService.name)
            const deleteObjectCommand: DeleteObjectCommand = new DeleteObjectCommand({
                Bucket: s3Bucket,
                Key: team.avatar_url.split('/').slice(-1)[0],
            })
            await s3Client.send(deleteObjectCommand)
        }
        return this.provider.update({ _id: this.provider.toObjectId(team.id) }, { $set: { avatar_url: null } })
    }

    public async deleteTeam(teamId: string): Promise<Team> {
        const team: Team = await this.getTeamById(teamId)
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        // Delete all reports
        const teamReports: Report[] = await this.reportsService.getReports({
            filter: {
                team_id: team.id,
            },
        })
        for (const report of teamReports) {
            await this.reportsService.deleteReport(report.id)
        }
        // Delete all members of this team
        await this.teamMemberProvider.deleteMany({ team_id: team.id })
        // Delete team
        await this.provider.deleteOne({ _id: this.provider.toObjectId(team.id) })
        return team
    }

    public async uploadMarkdownImage(userId: string, teamId: string, file: Express.Multer.File): Promise<string> {
        if (!file) {
            throw new PreconditionFailedException('Missing image file')
        }
        const teams: Team[] = await this.getTeamsForController(userId, {})
        const team: Team = teams.find((t: Team) => t.id === teamId)
        if (!team) {
            throw new PreconditionFailedException(`You don't have permissions to upload markdown images to this team`)
        }
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        const client: Client = await this.sftpService.getClient()
        const sftpDestinationFolder = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_DESTINATION_FOLDER)
        const containerFolder = `/${organization.sluglified_name}/${team.sluglified_name}/markdown-images`;
        const destinationPath = join(sftpDestinationFolder, containerFolder)
        const existsPath: boolean | string = await client.exists(destinationPath)
        if (!existsPath) {
            Logger.log(`Directory ${destinationPath} does not exist. Creating...`, ReportsService.name)
            await client.mkdir(destinationPath, true)
            Logger.log(`Created directory ${destinationPath} in ftp`, ReportsService.name)
        }
        const staticContentPrefix: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.STATIC_CONTENT_PREFIX)
        let ftpFilePath = ''
        let publicFilePath = ''
        do {
            const fileName = `${uuidv4()}${extname(file.originalname)}`
            ftpFilePath = join(destinationPath, fileName)
            publicFilePath = join(staticContentPrefix, containerFolder, fileName)
            const exists: boolean | string = await client.exists(ftpFilePath)
            if (!exists) {
                break
            }
        } while (true)
        await client.put(file.buffer, ftpFilePath)
        return publicFilePath
    }
}
