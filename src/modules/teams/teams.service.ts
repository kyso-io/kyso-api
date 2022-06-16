import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
    Comment,
    Discussion,
    GlobalPermissionsEnum,
    KysoRole,
    KysoSettingsEnum,
    Organization,
    OrganizationMember,
    OrganizationMemberJoin,
    Report,
    ReportPermissionsEnum,
    Team,
    TeamInfoDto,
    TeamMember,
    TeamMemberJoin,
    TeamMembershipOriginEnum,
    TeamVisibilityEnum,
    Token,
    UpdateTeamMembersDTO,
    User,
} from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Injectable, Logger, NotFoundException, PreconditionFailedException, Provider } from '@nestjs/common'
import * as moment from 'moment'
import { extname, join } from 'path'
import * as Client from 'ssh2-sftp-client'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { userHasPermission } from '../../helpers/permissions'
import slugify from '../../helpers/slugify'
import { PlatformRole } from '../../security/platform-roles'
import { CommentsService } from '../comments/comments.service'
import { DiscussionsService } from '../discussions/discussions.service'
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

    @Autowired({ typeName: 'CommentsService' })
    private commentsService: CommentsService

    @Autowired({ typeName: 'DiscussionsService' })
    private discussionsService: DiscussionsService

    constructor(
        private readonly mailerService: MailerService,
        private readonly provider: TeamsMongoProvider,
        private readonly teamMemberProvider: TeamMemberMongoProvider,
    ) {
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

    async getUniqueTeam(organizationId: string, teamSlugName: string): Promise<Team> {
        return this.getTeam({ filter: { sluglified_name: teamSlugName, organization_id: organizationId } })
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

        const finalResult = [...new Set(userTeamsResult.filter((team) => !!team))]

        return finalResult
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
            let organizationMembers: OrganizationMember[] = []
            // Build query object to retrieve all the users
            const user_ids: string[] = members.map((x: TeamMemberJoin) => {
                return x.member_id
            })
            if (team.visibility === TeamVisibilityEnum.PUBLIC || team.visibility === TeamVisibilityEnum.PROTECTED) {
                organizationMembers = await this.organizationsService.getOrganizationMembers(team.organization_id)

                organizationMembers.forEach((x: OrganizationMember) => {
                    const index: number = user_ids.indexOf(x.id)
                    if (index === -1) {
                        user_ids.push(x.id)
                    }
                })
            }

            // Build the query to retrieve all the users
            const filterArray = user_ids.map((id: string) => ({ _id: this.provider.toObjectId(id) }))

            if (filterArray.length === 0) {
                return []
            }

            const filter = { filter: { $or: filterArray } }

            const users = await this.usersService.getUsers(filter)

            const usersAndRoles = users.map((u: User) => {
                // Find role for this user in members
                const teamMember: TeamMemberJoin = members.find((tm: TeamMemberJoin) => u.id.toString() === tm.member_id)
                const orgMember: OrganizationMember = organizationMembers.find((om: OrganizationMember) => om.email === u.email)

                return {
                    ...u,
                    roles: teamMember ? teamMember.role_names : orgMember.organization_roles,
                    membership_origin: teamMember ? TeamMembershipOriginEnum.TEAM : TeamMembershipOriginEnum.ORGANIZATION,
                }
            })

            return usersAndRoles.map((x) => new TeamMember(x.id.toString(), x.display_name, x.name, x.roles, x.bio, x.avatar_url, x.email, x.membership_origin))
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
                case TeamVisibilityEnum.PUBLIC:
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
                // case TeamVisibilityEnum.PUBLIC:
                //     organizationMembersJoin = await this.organizationsService.getMembers(team.organization_id)
                //     userIds = organizationMembersJoin.map((x: OrganizationMemberJoin) => x.member_id)
                //     const restOfUsers: User[] = await this.usersService.getUsers({
                //         filter: { _id: { $nin: organizationMembersJoin.map((x: OrganizationMemberJoin) => x.member_id) } },
                //         projection: { _id: 1 },
                //     })
                //     for (const userId of restOfUsers) {
                //         userIds.push(userId.id)
                //     }
                //     break
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

            // CARE: THIS TEAM MEMBERSHIP IS NOT REAL, BUT AS IT'S USED FOR THE ASSIGNEES WE LET IT AS IS
            return users.map((user: User) => {
                return new TeamMember(
                    user.id.toString(),
                    user.display_name,
                    user.name,
                    [],
                    user.bio,
                    user.avatar_url,
                    user.email,
                    TeamMembershipOriginEnum.ORGANIZATION,
                )
            })
        } else {
            return []
        }
    }

    public async getAuthors(teamId: string): Promise<TeamMember[]> {
        const team: Team = await this.getTeamById(teamId)
        if (!team) {
            throw new NotFoundException(`Team with id ${teamId} not found`)
        }
        switch (team.visibility) {
            case TeamVisibilityEnum.PUBLIC:
                const users: User[] = await this.usersService.getUsers({
                    filter: {},
                })
                return users.map((user: User) => {
                    return new TeamMember(
                        user.id.toString(),
                        user.display_name,
                        user.name,
                        [],
                        user.bio,
                        user.avatar_url,
                        user.email,
                        TeamMembershipOriginEnum.ORGANIZATION,
                    )
                })
            case TeamVisibilityEnum.PROTECTED:
                const organizationMembers: OrganizationMember[] = await this.organizationsService.getOrganizationMembers(team.organization_id)
                return organizationMembers.map((member: OrganizationMember) => {
                    return new TeamMember(
                        member.id,
                        member.nickname,
                        member.username,
                        [],
                        member.bio,
                        member.avatar_url,
                        member.email,
                        TeamMembershipOriginEnum.ORGANIZATION,
                    )
                })
            case TeamVisibilityEnum.PRIVATE:
                return this.getMembers(team.id)
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

    public async addMemberToTeam(teamId: string, userId: string, roles: KysoRole[]): Promise<TeamMember[]> {
        const userBelongsToTeam = await this.userBelongsToTeam(teamId, userId)
        if (userBelongsToTeam) {
            throw new PreconditionFailedException('User already belongs to this team')
        }
        const team: Team = await this.getTeamById(teamId)
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)

        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }

        if (!organization) {
            throw new PreconditionFailedException("Team's organization not found")
        }

        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new PreconditionFailedException('User not found')
        }
        await this.addMembersById(
            teamId,
            [user.id],
            roles.map((x) => x.name),
        )

        // SEND NOTIFICATIONS
        try {
            const isCentralized: boolean = organization?.options?.notifications?.centralized || false
            const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)
            let emailsCentralized: string[] = []

            if (isCentralized) {
                emailsCentralized = organization.options.notifications.emails
            }

            // To the recently added user
            this.mailerService
                .sendMail({
                    to: user.email,
                    subject: `You were added to ${team.display_name} team`,
                    template: 'team-you-were-added',
                    context: {
                        addedUser: user,
                        organization,
                        team,
                        frontendUrl,
                        role: roles.map((x) => x.name),
                    },
                })
                .then((messageInfo) => {
                    Logger.log(`Report mail ${messageInfo.messageId} sent to ${user.email}`, TeamsService.name)
                })
                .catch((err) => {
                    Logger.error(`An error occurrend sending report mail to ${user.email}`, err, TeamsService.name)
                })

            // If is centralized, to the centralized mails
            if (isCentralized) {
                this.mailerService
                    .sendMail({
                        to: emailsCentralized,
                        subject: `A member was added from ${team.display_name} team`,
                        template: 'team-new-member',
                        context: {
                            addedUser: user,
                            organization,
                            team,
                            role: roles.map((x) => x.name),
                            frontendUrl,
                        },
                    })
                    .then((messageInfo) => {
                        Logger.log(`Report mail ${messageInfo.messageId} sent to ${user.email}`, OrganizationsService.name)
                    })
                    .catch((err) => {
                        Logger.error(`An error occurrend sending report mail to ${user.email}`, err, OrganizationsService.name)
                    })
            }
        } catch (ex) {
            Logger.error('Error sending notifications of new member in a team', ex)
        }

        return this.getMembers(teamId)
    }

    public async removeMemberFromTeam(teamId: string, userId: string): Promise<TeamMember[]> {
        const team: Team = await this.getTeamById(teamId)
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)

        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }

        if (!organization) {
            throw new PreconditionFailedException("Team's organization not found")
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

        /* WTH why that. Nope xD
        if (members.length === 0) {
            // Team without members, delete it
            await this.provider.deleteOne({ _id: this.provider.toObjectId(team.id) })
        }*/

        // SEND NOTIFICATIONS
        try {
            const isCentralized: boolean = organization?.options?.notifications?.centralized || false
            const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)
            let emailsCentralized: string[] = []

            if (isCentralized) {
                emailsCentralized = organization.options.notifications.emails
            }

            // To the recently added user
            this.mailerService
                .sendMail({
                    to: user.email,
                    subject: `You were removed to ${team.display_name} team`,
                    template: 'team-you-were-removed',
                    context: {
                        removedUser: user,
                        organization,
                        team,
                        frontendUrl,
                    },
                })
                .then((messageInfo) => {
                    Logger.log(`Report mail ${messageInfo.messageId} sent to ${user.email}`, TeamsService.name)
                })
                .catch((err) => {
                    Logger.error(`An error occurrend sending report mail to ${user.email}`, err, TeamsService.name)
                })

            // If is centralized, to the centralized mails
            if (isCentralized) {
                this.mailerService
                    .sendMail({
                        to: emailsCentralized,
                        subject: `A member was removed from ${team.display_name} team`,
                        template: 'team-removed-member',
                        context: {
                            removedUser: user,
                            organization,
                            team,
                            frontendUrl,
                        },
                    })
                    .then((messageInfo) => {
                        Logger.log(`Report mail ${messageInfo.messageId} sent to ${user.email}`, OrganizationsService.name)
                    })
                    .catch((err) => {
                        Logger.error(`An error occurrend sending report mail to ${user.email}`, err, OrganizationsService.name)
                    })
            }
        } catch (ex) {
            Logger.error('Error sending notifications of removed member in a team', ex)
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
                /*try {
                    const kysoRole: KysoRole = PlatformRole.ALL_PLATFORM_ROLES.find(x => x.name === element.role)
                    this.addMemberToTeam(team.id, element.userId, [kysoRole])
                } catch(ex) {
                    Logger.error(ex)
                }*/
                // IF IS NOT A MEMBER. CREATE IT
                this.teamMemberProvider.create(new TeamMemberJoin(team.id, element.userId, [element.role], true))
            } else {
                await this.teamMemberProvider.update({ _id: this.provider.toObjectId(member.id) }, { $set: { role_names: [element.role] } })
            }
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
        const containerFolder = `/${organization.sluglified_name}/${team.sluglified_name}/markdown-images`
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

    public async getTeamsInfo(token: Token, teamId?: string): Promise<TeamInfoDto[]> {
        const map: Map<string, { members: number; reports: number; discussions: number; comments: number; lastChange: Date }> = new Map<
            string,
            { members: number; reports: number; discussions: number; comments: number; lastChange: Date }
        >()
        for (const teamResourcePermission of token.permissions.teams) {
            if (teamId && teamId.length > 0 && teamId !== teamResourcePermission.id) {
                continue
            }
            if (!map.has(teamResourcePermission.id)) {
                const team: Team = await this.getTeamById(teamResourcePermission.id)
                const teamMembers: TeamMemberJoin[] = await this.teamMemberProvider.read({
                    filter: {
                        team_id: team.id,
                    },
                })
                map.set(team.id, {
                    members: teamMembers.length,
                    reports: 0,
                    discussions: 0,
                    comments: 0,
                    lastChange: team.updated_at,
                })
            }
        }
        let teams: Team[] = []
        const teamsQuery: any = {
            filter: {},
        }
        const reportsQuery: any = {
            filter: {},
        }
        const discussionsQuery: any = {
            filter: {},
        }
        if (teamId && teamId.length > 0) {
            teamsQuery.filter.id = teamId
        }
        if (token.isGlobalAdmin()) {
            teams = await this.getTeams(teamsQuery)
        } else {
            teams = await this.getTeamsForController(token.id, teamsQuery)
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
        }
        teams.forEach((team: Team) => {
            if (map.has(team.id)) {
                map.get(team.id).lastChange = moment.max(moment(team.updated_at), moment(map.get(team.id).lastChange)).toDate()
            }
        })
        const reports: Report[] = await this.reportsService.getReports(reportsQuery)
        const reportTeamMap: Map<string, string> = new Map<string, string>()
        reports.forEach((report: Report) => {
            reportTeamMap.set(report.id, report.team_id)
            if (!map.has(report.team_id)) {
                map.set(report.team_id, { members: 0, reports: 0, discussions: 0, comments: 0, lastChange: moment('1970-01-10').toDate() })
            }
            map.get(report.team_id).reports++
            map.get(report.team_id).lastChange = moment.max(moment(report.updated_at), moment(map.get(report.team_id).lastChange)).toDate()
        })
        const discussions: Discussion[] = await this.discussionsService.getDiscussions(discussionsQuery)
        const discussionTeamMap: Map<string, string> = new Map<string, string>()
        discussions.forEach((discussion: Discussion) => {
            discussionTeamMap.set(discussion.id, discussion.team_id)
            if (!map.has(discussion.team_id)) {
                map.set(discussion.team_id, {
                    members: 0,
                    reports: 0,
                    discussions: 0,
                    comments: 0,
                    lastChange: moment('1970-01-10').toDate(),
                })
            }
            map.get(discussion.team_id).discussions++
            map.get(discussion.team_id).lastChange = moment.max(moment(discussion.updated_at), moment(map.get(discussion.team_id).lastChange)).toDate()
        })
        const commentsQuery: any = {
            filter: {},
        }
        if (!token.isGlobalAdmin()) {
            commentsQuery.filter = {
                $or: [
                    {
                        report_id: { $in: reports.map((report: Report) => report.id) },
                        discussion_id: { $in: discussions.map((discussion: Discussion) => discussion.id) },
                    },
                ],
            }
        }
        const comments: Comment[] = await this.commentsService.getComments(commentsQuery)
        comments.forEach((comment: Comment) => {
            let teamId: string | null = null
            if (discussionTeamMap.has(comment.discussion_id)) {
                teamId = discussionTeamMap.get(comment.discussion_id)
            } else if (reportTeamMap.has(comment.report_id)) {
                teamId = reportTeamMap.get(comment.report_id)
            }
            if (!teamId) {
                return
            }
            if (!map.has(teamId)) {
                map.set(teamId, {
                    members: 0,
                    reports: 0,
                    discussions: 0,
                    comments: 0,
                    lastChange: moment('1970-01-10').toDate(),
                })
            }
            map.get(teamId).comments++
            map.get(teamId).lastChange = moment.max(moment(comment.updated_at), moment(map.get(teamId).lastChange)).toDate()
        })
        const result: TeamInfoDto[] = []
        map.forEach(
            (value: { members: number; reports: number; discussions: number; comments: number; lastChange: Date; avatar_url: string }, teamId: string) => {
                result.push({
                    team_id: teamId,
                    members: value.members,
                    reports: value.reports,
                    discussions: value.discussions,
                    comments: value.comments,
                    lastChange: value.lastChange,
                })
            },
        )
        return result
    }
}
