import {
  Comment,
  Discussion,
  GlobalPermissionsEnum,
  InlineComment,
  KysoEventEnum,
  KysoRole,
  KysoSettingsEnum,
  KysoTeamsAddMemberEvent,
  KysoTeamsCreateEvent,
  KysoTeamsDeleteEvent,
  KysoTeamsRemoveMemberEvent,
  KysoTeamsUpdateEvent,
  KysoTeamsUpdateMemberRolesEvent,
  Organization,
  OrganizationMember,
  OrganizationMemberJoin,
  PaginatedResponseDto,
  Report,
  ReportPermissionsEnum,
  ResourcePermissions,
  Team,
  TeamInfoDto,
  TeamMember,
  TeamMemberJoin,
  TeamMembershipOriginEnum,
  TeamsInfoQuery,
  TeamVisibilityEnum,
  Token,
  TokenPermissions,
  UpdateTeamMembersDTO,
  User,
  WebSocketEvent,
} from '@kyso-io/kyso-model';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException, Provider } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import * as moment from 'moment';
import { extname, join } from 'path';
import { NATSHelper } from 'src/helpers/natsHelper';
import { v4 as uuidv4 } from 'uuid';
import { Autowired } from '../../decorators/autowired';
import { AutowiredService } from '../../generic/autowired.generic';
import { userHasPermission } from '../../helpers/permissions';
import slugify from '../../helpers/slugify';
import { PlatformRole } from '../../security/platform-roles';
import { ActivityFeedService } from '../activity-feed/activity-feed.service';
import { AuthService } from '../auth/auth.service';
import { CommentsService } from '../comments/comments.service';
import { DiscussionsService } from '../discussions/discussions.service';
import { EventsGateway } from '../events/events.gateway';
import { InlineCommentsService } from '../inline-comments/inline-comments.service';
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ReportsService } from '../reports/reports.service';
import { SftpService } from '../reports/sftp.service';
import { UsersService } from '../users/users.service';
import { TeamMemberMongoProvider } from './providers/mongo-team-member.provider';
import { TeamsMongoProvider } from './providers/mongo-teams.provider';

function factory(service: TeamsService) {
  return service;
}

export function createProvider(): Provider<TeamsService> {
  return {
    provide: `${TeamsService.name}`,
    useFactory: (service) => factory(service),
    inject: [TeamsService],
  };
}

@Injectable()
export class TeamsService extends AutowiredService {
  @Autowired({ typeName: 'UsersService' })
  private usersService: UsersService;

  @Autowired({ typeName: 'OrganizationsService' })
  private organizationsService: OrganizationsService;

  @Autowired({ typeName: 'ReportsService' })
  private reportsService: ReportsService;

  @Autowired({ typeName: 'KysoSettingsService' })
  private kysoSettingsService: KysoSettingsService;

  @Autowired({ typeName: 'SftpService' })
  private sftpService: SftpService;

  @Autowired({ typeName: 'CommentsService' })
  private commentsService: CommentsService;

  @Autowired({ typeName: 'DiscussionsService' })
  private discussionsService: DiscussionsService;

  @Autowired({ typeName: 'InlineCommentsService' })
  private inlineCommentsService: InlineCommentsService;

  @Autowired({ typeName: 'ActivityFeedService' })
  private activityFeedService: ActivityFeedService;

  @Autowired({ typeName: 'AuthService' })
  private authService: AuthService;

  constructor(
    private readonly eventsGateway: EventsGateway,
    private readonly provider: TeamsMongoProvider,
    private readonly teamMemberProvider: TeamMemberMongoProvider,
    @Inject('NATS_SERVICE') private client: ClientProxy,
  ) {
    super();
  }

  public async getTeamById(id: string): Promise<Team> {
    return this.getTeam({ filter: { _id: this.provider.toObjectId(id) } });
  }

  async getTeam(query: any): Promise<Team> {
    const teams = await this.provider.read(query);
    if (teams.length === 0) {
      return null;
    }
    return teams[0];
  }

  async getUniqueTeam(organizationId: string, teamSlugName: string): Promise<Team> {
    return this.getTeam({ filter: { sluglified_name: teamSlugName, organization_id: organizationId } });
  }

  async getTeams(query): Promise<Team[]> {
    return await this.provider.read(query);
  }

  /**
   * Get all teams that are visible for the specified user
   *
   * @param user
   */
  public async getTeamsVisibleForUser(userId: string, organizationId?: string): Promise<Team[]> {
    const teamIds: Map<string, Team> = new Map<string, Team>();
    // All public teams
    const userTeamsResult: Team[] = await this.getTeams({ filter: { visibility: TeamVisibilityEnum.PUBLIC } });
    userTeamsResult.forEach((team: Team) => {
      teamIds.set(team.id, team);
    });

    // All protected teams from organizations that the user belongs
    const filterOrganizationMembers: any = {
      member_id: userId,
    };
    if (organizationId) {
      filterOrganizationMembers.organization_id = organizationId;
    }
    const allUserOrganizations: OrganizationMemberJoin[] = await this.organizationsService.searchMembersJoin({ filter: filterOrganizationMembers });

    const protectedTeamPromises: Promise<Team[]>[] = [];
    for (const organizationMembership of allUserOrganizations) {
      protectedTeamPromises.push(this.getTeams({ filter: { organization_id: organizationMembership.organization_id, visibility: TeamVisibilityEnum.PROTECTED } }));
    }
    const protectedTeams: Team[][] = await Promise.all(protectedTeamPromises);
    protectedTeams.forEach((teams: Team[]) => {
      teams.forEach((team: Team) => {
        teamIds.set(team.id, team);
      });
    });

    // All teams (whenever is public, private or protected) in which user is member
    const teamMembers: TeamMemberJoin[] = await this.searchMembers({ filter: { member_id: userId } });
    const userMemberTeamPromises: Promise<Team>[] = [];
    for (const m of teamMembers) {
      if (teamIds.has(m.team_id)) {
        continue;
      }
      userMemberTeamPromises.push(this.getTeam({ filter: { _id: this.provider.toObjectId(m.team_id) } }));
    }
    const userMemberTeams: Team[] = await Promise.all(userMemberTeamPromises);
    userMemberTeams.forEach((team: Team) => {
      teamIds.set(team.id, team);
    });

    return Array.from(teamIds.values());
  }

  public async getTeamsForController(userId: string, query: any): Promise<Team[]> {
    const teams: Team[] = await this.getTeams(query);
    const validMap: Map<string, boolean> = new Map<string, boolean>();
    teams.forEach((team: Team) => {
      if (team.visibility === TeamVisibilityEnum.PUBLIC) {
        validMap.set(team.id, true);
      }
    });
    // All protected teams from organizations that the user belongs
    const filterOrganizationMembers: any = {
      member_id: userId,
    };
    if (query.filter?.organization_id && query.filter.organization_id.length > 0) {
      filterOrganizationMembers.organization_id = query.filter.organization_id;
    }
    const allUserOrganizations: OrganizationMemberJoin[] = await this.organizationsService.searchMembersJoin({ filter: filterOrganizationMembers });
    for (const organizationMembership of allUserOrganizations) {
      const result: Team[] = await this.getTeams({
        filter: {
          organization_id: organizationMembership.organization_id,
          visibility: TeamVisibilityEnum.PROTECTED,
        },
      });
      result.forEach((team: Team) => {
        validMap.set(team.id, true);
      });
    }
    // All teams (whenever is public, private or protected) in which user is member
    const members: TeamMemberJoin[] = await this.searchMembers({ filter: { member_id: userId } });
    for (const m of members) {
      const filterTeam: any = {
        _id: this.provider.toObjectId(m.team_id),
      };
      if (query.filter?.organization_id && query.filter.organization_id.length > 0) {
        filterTeam.organization_id = query.filter.organization_id;
      }
      const result: Team = await this.getTeam({ filter: filterTeam });
      if (result) {
        validMap.set(result.id, true);
      }
    }
    return teams.filter((team: Team) => validMap.has(team.id));
  }

  async searchMembers(query: any): Promise<TeamMemberJoin[]> {
    const userTeamMembership: TeamMemberJoin[] = await this.teamMemberProvider.read(query);
    const map: Map<string, TeamMemberJoin> = new Map<string, TeamMemberJoin>();
    for (const userTeam of userTeamMembership) {
      const key = `${userTeam.team_id}-${userTeam.member_id}`;
      if (map.has(key)) {
        // User is in team twice
        await this.teamMemberProvider.deleteOne({ _id: this.provider.toObjectId(userTeam.id) });
        continue;
      }
      map.set(key, userTeam);
    }
    return Array.from(userTeamMembership.values());
  }

  async addMembersById(teamId: string, memberIds: string[], rolesToApply: string[], silent?: boolean, userCreatingAction?: User): Promise<void> {
    const team: Team = await this.getTeamById(teamId);
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL);
    for (const userId of memberIds) {
      const belongs: boolean = await this.userBelongsToTeam(teamId, userId);
      if (belongs) {
        continue;
      }
      const member: TeamMemberJoin = new TeamMemberJoin(teamId, userId, rolesToApply, true);
      await this.teamMemberProvider.create(member);
      const user: User = await this.usersService.getUserById(userId);

      if (!silent) {
        NATSHelper.safelyEmit<KysoTeamsAddMemberEvent>(this.client, KysoEventEnum.TEAMS_ADD_MEMBER, {
          userCreatingAction: userCreatingAction ?? null,
          userReceivingAction: user,
          organization,
          team,
          frontendUrl,
          roles: rolesToApply,
        });
      }
    }
  }

  public async getMembers(teamId: string): Promise<TeamMember[]> {
    const team: Team = await this.getTeamById(teamId);
    if (team) {
      // Get all the members of this team
      const members: TeamMemberJoin[] = await this.teamMemberProvider.getMembers(team.id);
      let organizationMembers: OrganizationMember[] = [];
      // Build query object to retrieve all the users
      const user_ids: string[] = members.map((x: TeamMemberJoin) => {
        return x.member_id;
      });
      if (team.visibility === TeamVisibilityEnum.PUBLIC || team.visibility === TeamVisibilityEnum.PROTECTED) {
        organizationMembers = await this.organizationsService.getOrganizationMembers(team.organization_id);

        organizationMembers.forEach((x: OrganizationMember) => {
          const index: number = user_ids.indexOf(x.id);
          if (index === -1) {
            user_ids.push(x.id);
          }
        });
      }

      // Build the query to retrieve all the users
      const filterArray = user_ids.map((id: string) => ({ _id: this.provider.toObjectId(id) }));

      if (filterArray.length === 0) {
        return [];
      }

      const filter = { filter: { $or: filterArray } };

      const users = await this.usersService.getUsers(filter);

      const usersAndRoles = users.map((u: User) => {
        // Find role for this user in members
        const teamMember: TeamMemberJoin = members.find((tm: TeamMemberJoin) => u.id.toString() === tm.member_id);
        const orgMember: OrganizationMember = organizationMembers.find((om: OrganizationMember) => om.email === u.email);

        return {
          ...u,
          roles: teamMember ? teamMember.role_names : orgMember.organization_roles,
          membership_origin: teamMember ? TeamMembershipOriginEnum.TEAM : TeamMembershipOriginEnum.ORGANIZATION,
        };
      });

      return usersAndRoles.map((x) => new TeamMember(x.id.toString(), x.display_name, x.username, x.roles, x.bio, x.avatar_url, x.email, x.membership_origin));
    } else {
      return [];
    }
  }

  public async getAssignees(teamId: string): Promise<TeamMember[]> {
    const team: Team = await this.getTeamById(teamId);
    if (team) {
      let userIds: string[] = [];
      let teamMembersJoin: TeamMemberJoin[] = [];
      let users: User[] = [];
      let organizationMembersJoin: OrganizationMemberJoin[] = [];
      switch (team.visibility) {
        case TeamVisibilityEnum.PRIVATE:
          teamMembersJoin = await this.teamMemberProvider.getMembers(team.id);
          userIds = teamMembersJoin.map((x: TeamMemberJoin) => x.member_id);
          break;
        case TeamVisibilityEnum.PROTECTED:
        case TeamVisibilityEnum.PUBLIC:
          teamMembersJoin = await this.teamMemberProvider.getMembers(team.id);
          userIds = teamMembersJoin.map((x: TeamMemberJoin) => x.member_id);
          organizationMembersJoin = await this.organizationsService.getMembers(team.organization_id);
          for (const element of organizationMembersJoin) {
            const index: number = userIds.indexOf(element.member_id);
            if (index === -1) {
              userIds.push(element.member_id);
            }
          }
          break;
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
        return [];
      }
      users = await this.usersService.getUsers({
        filter: { _id: { $in: userIds.map((userId: string) => this.provider.toObjectId(userId)) } },
      });
      // Sort users based on the order of userIds
      users.sort((userCreatingAction: User, userReceivingAction: User) => {
        return userIds.indexOf(userCreatingAction.id) - userIds.indexOf(userReceivingAction.id);
      });

      // CARE: THIS TEAM MEMBERSHIP IS NOT REAL, BUT AS IT'S USED FOR THE ASSIGNEES WE LET IT AS IS
      return users.map((user: User) => {
        return new TeamMember(user.id.toString(), user.display_name, user.name, [], user.bio, user.avatar_url, user.email, TeamMembershipOriginEnum.ORGANIZATION);
      });
    } else {
      return [];
    }
  }

  public async getAuthors(teamId: string): Promise<TeamMember[]> {
    const team: Team = await this.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException(`Team with id ${teamId} not found`);
    }
    switch (team.visibility) {
      case TeamVisibilityEnum.PUBLIC:
        const users: User[] = await this.usersService.getUsers({
          filter: {},
        });
        return users.map((user: User) => {
          return new TeamMember(user.id.toString(), user.display_name, user.name, [], user.bio, user.avatar_url, user.email, TeamMembershipOriginEnum.ORGANIZATION);
        });
      case TeamVisibilityEnum.PROTECTED:
        const organizationMembers: OrganizationMember[] = await this.organizationsService.getOrganizationMembers(team.organization_id);
        return organizationMembers.map((member: OrganizationMember) => {
          return new TeamMember(member.id, member.nickname, member.username, [], member.bio, member.avatar_url, member.email, TeamMembershipOriginEnum.ORGANIZATION);
        });
      case TeamVisibilityEnum.PRIVATE:
        return this.getMembers(team.id);
    }
  }

  async updateTeam(token: Token, filterQuery: any, updateQuery: any): Promise<Team> {
    const team: Team = await this.provider.update(filterQuery, updateQuery);
    if (team) {
      const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);

      NATSHelper.safelyEmit<KysoTeamsUpdateEvent>(this.client, KysoEventEnum.TEAMS_UPDATE, {
        user: await this.usersService.getUserById(token.id),
        organization,
        team,
      });
    }
    return team;
  }

  async createTeam(token: Token, team: Team, silent?: boolean): Promise<Team> {
    if (team.visibility === TeamVisibilityEnum.PUBLIC) {
      const allowPublicChannels: boolean = (await this.kysoSettingsService.getValue(KysoSettingsEnum.ALLOW_PUBLIC_CHANNELS)) === 'true';
      if (!allowPublicChannels) {
        throw new ForbiddenException('This instance of Kyso does not allow public channels');
      }
    }
    const numTeamsCreatedByUser: number = await this.provider.count({ filter: { user_id: token.id } });
    const value: number = parseInt(await this.kysoSettingsService.getValue(KysoSettingsEnum.MAX_TEAMS_PER_USER), 10);
    if (numTeamsCreatedByUser >= value) {
      throw new ForbiddenException('You have reached the maximum number of teams you can create');
    }
    try {
      team.sluglified_name = slugify(team.display_name);

      // The name of this team exists in the organization?
      const teams: Team[] = await this.provider.read({ filter: { sluglified_name: team.sluglified_name, organization_id: team.organization_id } });

      if (teams.length > 0) {
        let i = teams.length + 1;
        do {
          const candidate_sluglified_name = `${team.sluglified_name}-${i}`;
          const index: number = teams.findIndex((t: Team) => t.sluglified_name === candidate_sluglified_name);
          if (index === -1) {
            team.sluglified_name = candidate_sluglified_name;
            break;
          }
          i++;
        } while (true);
      }

      const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
      if (!organization) {
        throw new NotFoundException('The organization does not exist');
      }

      const users: User[] = await this.usersService.getUsers({ filter: { sluglified_name: team.sluglified_name } });
      if (users.length > 0) {
        throw new ConflictException('There is already a user with this sluglified_name');
      }

      team.user_id = token.id;
      const newTeam: Team = await this.provider.create(team);

      if (token) {
        await this.addMembersById(newTeam.id, [token.id], [PlatformRole.TEAM_ADMIN_ROLE.name], silent);

        if (!silent) {
          NATSHelper.safelyEmit<KysoTeamsCreateEvent>(this.client, KysoEventEnum.TEAMS_CREATE, {
            user: await this.usersService.getUserById(token.id),
            organization,
            team: newTeam,
            frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
          });
        }
      }
      return newTeam;
    } catch (e) {
      Logger.error(e);
    }
  }

  public async getReportsOfTeam(token: Token, teamId: string): Promise<Report[]> {
    const team: Team = await this.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    const reports: Report[] = await this.reportsService.getReports({ filter: { team_id: team.id } });
    const userTeams: Team[] = await this.getTeamsVisibleForUser(token.id, team.organization_id);
    const userInTeam: boolean = userTeams.find((x) => x.id === team.id) !== undefined;
    const members: OrganizationMemberJoin[] = await this.organizationsService.getMembers(team.organization_id);
    const userBelongsToOrganization: boolean = members.find((x: OrganizationMemberJoin) => x.member_id === token.id) !== undefined;
    const hasGlobalPermissionAdmin: boolean = userHasPermission(token, GlobalPermissionsEnum.GLOBAL_ADMIN);
    if (team.visibility === TeamVisibilityEnum.PUBLIC) {
      if (!userInTeam && !userBelongsToOrganization && !hasGlobalPermissionAdmin) {
        throw new ForbiddenException('You are not a member of this team and not of the organization');
      }
      return reports;
    } else if (team.visibility === TeamVisibilityEnum.PROTECTED) {
      if (!userInTeam && !userBelongsToOrganization) {
        throw new ForbiddenException('You are not a member of this team and not of the organization');
      }
      const userHasReportPermissionRead: boolean = userHasPermission(token, ReportPermissionsEnum.READ);
      const userHasReportPermissionAdmin: boolean = userHasPermission(token, ReportPermissionsEnum.ADMIN);
      if (!userHasReportPermissionRead && !userHasReportPermissionAdmin && !hasGlobalPermissionAdmin && !userBelongsToOrganization) {
        throw new ForbiddenException('User does not have permission to read reports');
      }
      return reports;
    } else if (team.visibility === TeamVisibilityEnum.PRIVATE) {
      if (!hasGlobalPermissionAdmin && !userInTeam) {
        throw new ForbiddenException('You are not a member of this team');
      }
      const userHasReportPermissionRead: boolean = userHasPermission(token, ReportPermissionsEnum.READ);
      const userHasReportPermissionAdmin: boolean = userHasPermission(token, ReportPermissionsEnum.ADMIN);
      if (!userHasReportPermissionRead && !userHasReportPermissionAdmin && !hasGlobalPermissionAdmin) {
        throw new ForbiddenException('User does not have permission to read reports');
      }
      return reports;
    }
    return [];
  }

  public async deleteGivenOrganization(token: Token, organization_id: string): Promise<void> {
    // Get all team  of the organization
    const teams: Team[] = await this.getTeams({ filter: { organization_id } });
    const notifyUsers: boolean = teams.length > 1;
    for (const team of teams) {
      await this.deleteTeam(token, team.id, notifyUsers);
    }
  }

  public async getUserTeams(user_id: string): Promise<Team[]> {
    const userInTeams: TeamMemberJoin[] = await this.teamMemberProvider.read({ filter: { member_id: user_id } });
    return this.provider.read({ filter: { _id: { $in: userInTeams.map((x) => this.provider.toObjectId(x.team_id)) } } });
  }

  public async userBelongsToTeam(teamId: string, userId: string): Promise<boolean> {
    const team: Team = await this.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const user: User = await this.usersService.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const members: TeamMember[] = await this.getMembers(team.id);
    const index: number = members.findIndex((member: TeamMember) => member.id === user.id);
    return index !== -1;
  }

  public async addMemberToTeam(teamId: string, userId: string, roles: KysoRole[], token?: Token): Promise<TeamMember[]> {
    const userBelongsToTeam = await this.userBelongsToTeam(teamId, userId);
    if (userBelongsToTeam) {
      throw new ConflictException('User already belongs to this team');
    }
    const team: Team = await this.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    if (!organization) {
      throw new NotFoundException("Team's organization not found");
    }
    const user: User = await this.usersService.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.addMembersById(
      teamId,
      [user.id],
      roles.map((x) => x.name),
      false,
      token ? await this.usersService.getUserById(token.id) : undefined,
    );
    this.eventsGateway.sendToUser(user.id, WebSocketEvent.REFRESH_PERMISSIONS, null);
    return this.getMembers(teamId);
  }

  public async removeMemberFromTeam(teamId: string, userId: string, token: Token = null): Promise<TeamMember[]> {
    const team: Team = await this.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    if (!organization) {
      throw new NotFoundException("Team's organization not found");
    }
    const user: User = await this.usersService.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const members: TeamMemberJoin[] = await this.teamMemberProvider.read({ filter: { team_id: team.id } });
    const index: number = members.findIndex((x) => x.member_id === user.id);
    if (index === -1) {
      throw new NotFoundException('User is not a member of this team');
    }

    await this.teamMemberProvider.deleteOne({ team_id: team.id, member_id: user.id });
    members.splice(index, 1);
    if (token) {
      // SEND NOTIFICATIONS
      const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL);
      NATSHelper.safelyEmit<KysoTeamsRemoveMemberEvent>(this.client, KysoEventEnum.TEAMS_REMOVE_MEMBER, {
        userCreatingAction: await this.usersService.getUserById(token.id),
        user,
        organization,
        team,
        frontendUrl,
      });
    }
    this.eventsGateway.sendToUser(user.id, WebSocketEvent.REFRESH_PERMISSIONS, null);
    return this.getMembers(team.id);
  }

  public async updateTeamMembersDTORoles(token: Token, teamId: string, data: UpdateTeamMembersDTO): Promise<TeamMember[]> {
    const team: Team = await this.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL);
    const members: TeamMemberJoin[] = await this.teamMemberProvider.getMembers(team.id);
    for (const element of data.members) {
      const user: User = await this.usersService.getUserById(element.userId);
      if (!user) {
        throw new NotFoundException('User does not exist');
      }
      const member: TeamMemberJoin = members.find((x: TeamMemberJoin) => x.member_id === user.id);
      if (!member) {
        const teamMemberJoin: TeamMemberJoin = new TeamMemberJoin(teamId, user.id, [element.role], true);
        await this.teamMemberProvider.create(teamMemberJoin);
      } else {
        await this.teamMemberProvider.update({ _id: this.provider.toObjectId(member.id) }, { $set: { role_names: [element.role] } });
      }

      // Check if user belongs to the organization
      const organizationMembers: OrganizationMemberJoin[] = await this.organizationsService.searchMembersJoin({ filter: { organization_id: organization.id, member_id: user.id } });
      if (organizationMembers.length === 0) {
        // If the user does not belong to the organization, we notify him that he has been added to the team
        NATSHelper.safelyEmit<KysoTeamsAddMemberEvent>(this.client, KysoEventEnum.TEAMS_ADD_MEMBER, {
          userCreatingAction: await this.usersService.getUserById(token.id),
          userReceivingAction: user,
          organization,
          team,
          frontendUrl,
          roles: [element.role],
        });
      } else {
        // If the user already belonged to the organization...
        if (team.visibility === TeamVisibilityEnum.PRIVATE) {
          // and if the team is private...
          if (member) {
            // It means his roles have been updated!
            NATSHelper.safelyEmit<KysoTeamsUpdateMemberRolesEvent>(this.client, KysoEventEnum.TEAMS_UPDATE_MEMBER_ROLES, {
              userCreatingAction: await this.usersService.getUserById(token.id),
              userReceivingAction: user,
              team,
              frontendUrl,
              previousRoles: member.role_names,
              currentRoles: [element.role],
            });
          } else {
            // we notify him that he has been added to the team
            NATSHelper.safelyEmit<KysoTeamsAddMemberEvent>(this.client, KysoEventEnum.TEAMS_ADD_MEMBER, {
              userCreatingAction: await this.usersService.getUserById(token.id),
              userReceivingAction: user,
              organization,
              team,
              frontendUrl,
              roles: [element.role],
            });
          }
        } else {
          if (member) {
            // Otherwise (protected and public teams) he is a member of the organization and he already had access to the rest of the teams, in practice it is an update of his role
            NATSHelper.safelyEmit<KysoTeamsUpdateMemberRolesEvent>(this.client, KysoEventEnum.TEAMS_UPDATE_MEMBER_ROLES, {
              userCreatingAction: await this.usersService.getUserById(token.id),
              userReceivingAction: user,
              organization,
              team,
              frontendUrl,
              previousRoles: member ? member.role_names : [],
              currentRoles: [element.role],
            });
          } else {
            // we notify him that he has been added to the team
            NATSHelper.safelyEmit<KysoTeamsAddMemberEvent>(this.client, KysoEventEnum.TEAMS_ADD_MEMBER, {
              userCreatingAction: await this.usersService.getUserById(token.id),
              userReceivingAction: user,
              organization,
              team,
              frontendUrl,
              roles: [element.role],
            });
          }
        }
      }
      this.eventsGateway.sendToUser(user.id, WebSocketEvent.REFRESH_PERMISSIONS, null);
    }
    return this.getMembers(team.id);
  }

  public async removeTeamMemberRole(teamId: string, userId: string, role: string): Promise<TeamMember[]> {
    const team: Team = await this.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    const user: User = await this.usersService.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User does not exist');
    }
    const members: TeamMemberJoin[] = await this.teamMemberProvider.getMembers(team.id);
    const member: TeamMemberJoin = members.find((x: TeamMemberJoin) => x.member_id === user.id);
    if (!member) {
      throw new NotFoundException('User is not a member of this team');
    }
    const index: number = member.role_names.findIndex((x: string) => x === role);
    if (index === -1) {
      throw new BadRequestException('User does not have this role');
    }
    await this.teamMemberProvider.update({ _id: this.provider.toObjectId(member.id) }, { $pull: { role_names: role } });
    this.eventsGateway.sendToUser(user.id, WebSocketEvent.REFRESH_PERMISSIONS, null);
    return this.getMembers(userId);
  }

  public async setProfilePicture(token: Token, teamId: string, file: Express.Multer.File): Promise<Team> {
    let team: Team = await this.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    let avatar_url: string;
    try {
      avatar_url = await this.sftpService.uploadPublicFileFromPost(file);
    } catch (e) {
      Logger.error(`An error occurred while uploading the team image`, e, TeamsService.name);
      throw new InternalServerErrorException('Error uploading the team image');
    }
    const scsPublicPrefix: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.STATIC_CONTENT_PUBLIC_PREFIX);
    if (!scsPublicPrefix) {
      Logger.error('STATIC_CONTENT_PUBLIC_PREFIX is not defined', TeamsService.name);
      throw new InternalServerErrorException('Error uploading file');
    }
    if (team?.avatar_url && team.avatar_url !== avatar_url && team.avatar_url.startsWith(scsPublicPrefix)) {
      // Check if some entity is using the image
      const usersAvatarUrl: User[] = await this.usersService.getUsers({ filter: { avatar_url: team.avatar_url } });
      const usersBackgroundUrl: User[] = await this.usersService.getUsers({ filter: { background_image_url: team.avatar_url } });
      const organizations: Organization[] = await this.organizationsService.getOrganizations({
        filter: { avatar_url: team.avatar_url },
      });
      const teams: Team[] = await this.getTeams({ filter: { avatar_url: team.avatar_url, id: { $ne: team.id } } });
      const reports: Report[] = await this.reportsService.getReports({ filter: { preview_picture: team.avatar_url } });
      if (usersAvatarUrl.length === 0 && usersBackgroundUrl.length === 0 && organizations.length === 0 && teams.length === 0 && reports.length === 0) {
        // Remove file from SFTP
        try {
          await this.sftpService.deletePublicFile(team.avatar_url);
        } catch (e) {
          Logger.error(`An error occurred while deleting the team image`, e, TeamsService.name);
        }
      }
    }
    team = await this.provider.update({ _id: this.provider.toObjectId(team.id) }, { $set: { avatar_url } });
    if (team) {
      const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
      NATSHelper.safelyEmit<KysoTeamsUpdateEvent>(this.client, KysoEventEnum.TEAMS_UPDATE, {
        user: await this.usersService.getUserById(token.id),
        organization,
        team,
      });
    }
    return team;
  }

  public async deleteProfilePicture(token: Token, teamId: string): Promise<Team> {
    let team: Team = await this.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    const scsPublicPrefix: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.STATIC_CONTENT_PUBLIC_PREFIX);
    if (team?.avatar_url && team.avatar_url.startsWith(scsPublicPrefix)) {
      // Check if some entity is using the image
      const usersAvatarUrl: User[] = await this.usersService.getUsers({ filter: { avatar_url: team.avatar_url } });
      const usersBackgroundUrl: User[] = await this.usersService.getUsers({ filter: { background_image_url: team.avatar_url } });
      const organizations: Organization[] = await this.organizationsService.getOrganizations({
        filter: { avatar_url: team.avatar_url },
      });
      const teams: Team[] = await this.getTeams({ filter: { avatar_url: team.avatar_url, id: { $ne: team.id } } });
      const reports: Report[] = await this.reportsService.getReports({ filter: { preview_picture: team.avatar_url } });
      if (usersAvatarUrl.length === 0 && usersBackgroundUrl.length === 0 && organizations.length === 0 && teams.length === 0 && reports.length === 0) {
        // Remove file from SFTP
        try {
          await this.sftpService.deletePublicFile(team.avatar_url);
        } catch (e) {
          Logger.error(`An error occurred while deleting the team image`, e, TeamsService.name);
        }
      }
    }
    team = await this.provider.update({ _id: this.provider.toObjectId(team.id) }, { $set: { avatar_url: null } });
    if (team) {
      const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
      NATSHelper.safelyEmit<KysoTeamsUpdateEvent>(this.client, KysoEventEnum.TEAMS_UPDATE, {
        user: await this.usersService.getUserById(token.id),
        organization,
        team,
      });
    }
    return team;
  }

  public async deleteTeam(token: Token, teamId: string, notifyUsers = true): Promise<Team> {
    const team: Team = await this.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    // Get team members before deleting
    const teamMembers: TeamMember[] = await this.getMembers(teamId);
    // Delete all reports
    const teamReports: Report[] = await this.reportsService.getReports({
      filter: {
        team_id: team.id,
      },
    });
    for (const report of teamReports) {
      await this.reportsService.deleteReport(token, report.id, true);
    }
    // Delete all activity feed from this team
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    await this.activityFeedService.deleteActivityFeed({
      organization: organization.sluglified_name,
      team: team.sluglified_name,
    });
    // Delete all members of this team
    await this.teamMemberProvider.deleteMany({ team_id: team.id });
    // Delete image
    await this.deleteProfilePicture(token, team.id);
    // Delete team
    await this.provider.deleteOne({ _id: this.provider.toObjectId(team.id) });
    NATSHelper.safelyEmit<KysoTeamsDeleteEvent>(this.client, KysoEventEnum.TEAMS_DELETE, {
      user: await this.usersService.getUserById(token.id),
      organization,
      team,
      user_ids: teamMembers.map((teamMember: TeamMember) => teamMember.id),
      frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
      notifyUsers,
    });
    for (const teamMember of teamMembers) {
      this.eventsGateway.sendToUser(teamMember.id, WebSocketEvent.REFRESH_PERMISSIONS, null);
    }
    return team;
  }

  public async uploadMarkdownImage(userId: string, teamId: string, file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException('Missing image file');
    }
    const teams: Team[] = await this.getTeamsForController(userId, {});
    const team: Team = teams.find((t: Team) => t.id === teamId);
    if (!team) {
      throw new ForbiddenException(`You don't have permissions to upload markdown images to this team`);
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    const username: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_USERNAME);
    const password: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PASSWORD);
    const { client } = await this.sftpService.getClient(username, password);
    const sftpDestinationFolder = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_DESTINATION_FOLDER);
    const containerFolder = `/${organization.sluglified_name}/${team.sluglified_name}/markdown-images`;
    const destinationPath = join(sftpDestinationFolder, containerFolder);
    const existsPath: boolean | string = await client.exists(destinationPath);
    if (!existsPath) {
      Logger.log(`Directory ${destinationPath} does not exist. Creating...`, ReportsService.name);
      await client.mkdir(destinationPath, true);
      Logger.log(`Created directory ${destinationPath} in ftp`, ReportsService.name);
    }
    const staticContentPrefix: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.STATIC_CONTENT_PREFIX);
    let ftpFilePath = '';
    let publicFilePath = '';
    do {
      const fileName = `${uuidv4()}${extname(file.originalname)}`;
      ftpFilePath = join(destinationPath, fileName);
      publicFilePath = join(staticContentPrefix, containerFolder, fileName);
      const exists: boolean | string = await client.exists(ftpFilePath);
      if (!exists) {
        break;
      }
    } while (true);
    await client.put(file.buffer, ftpFilePath);
    return publicFilePath;
  }

  public async getTeamsInfo(token: Token, teamsInfoQuery: TeamsInfoQuery): Promise<PaginatedResponseDto<TeamInfoDto>> {
    const paginatedResponseDto: PaginatedResponseDto<TeamInfoDto> = new PaginatedResponseDto<TeamInfoDto>(teamsInfoQuery.page, 0, 0, [], 0, 0);
    const tokenPermissions: TokenPermissions = await this.authService.getPermissions(token?.username);
    tokenPermissions.teams = tokenPermissions.teams.filter((teamResourcePermission: ResourcePermissions) => teamResourcePermission.organization_id === teamsInfoQuery.organizationId);
    if (teamsInfoQuery.teamId) {
      tokenPermissions.teams = tokenPermissions.teams.filter((teamResourcePermission: ResourcePermissions) => teamResourcePermission.id === teamsInfoQuery.teamId);
    }
    if (tokenPermissions.teams.length === 0) {
      return paginatedResponseDto;
    }
    if (teamsInfoQuery.search) {
      tokenPermissions.teams = tokenPermissions.teams.filter((teamResourcePermission: ResourcePermissions) => {
        return teamResourcePermission.name.toLowerCase().includes(teamsInfoQuery.search.toLowerCase());
      });
    }
    tokenPermissions.teams.sort((a: ResourcePermissions, b: ResourcePermissions) => {
      const aName: string = a.name.toLowerCase();
      const bName: string = b.name.toLowerCase();
      if (aName < bName) {
        return -1;
      } else if (aName > bName) {
        return 1;
      } else {
        return 0;
      }
    });
    const numTeams: number = tokenPermissions.teams.length;
    const numPages: number = Math.ceil(numTeams / teamsInfoQuery.limit);
    // Given page (From 1 to n) and page size, calculate the start and end index of the teams to return
    const startIndex: number = (teamsInfoQuery.page - 1) * teamsInfoQuery.limit;
    const endIndex: number = Math.min(startIndex + teamsInfoQuery.limit, numTeams);
    tokenPermissions.teams = tokenPermissions.teams.slice(startIndex, endIndex);

    paginatedResponseDto.itemCount = tokenPermissions.teams.length;
    paginatedResponseDto.itemsPerPage = teamsInfoQuery.limit;
    paginatedResponseDto.totalItems = numTeams;
    paginatedResponseDto.totalPages = numPages;

    const map: Map<string, { members: number; reports: number; discussions: number; comments: number; lastChange: Date }> = new Map<
      string,
      { members: number; reports: number; discussions: number; comments: number; lastChange: Date }
    >();
    for (const teamResourcePermission of tokenPermissions.teams) {
      if (!map.has(teamResourcePermission.id)) {
        const team: Team = await this.getTeamById(teamResourcePermission.id);
        const teamMembers: TeamMember[] = await this.getMembers(team.id);
        map.set(team.id, {
          members: teamMembers.length,
          reports: 0,
          discussions: 0,
          comments: 0,
          lastChange: team.updated_at,
        });
      }
    }
    const teamsQuery: any = {
      filter: {
        id: { $in: tokenPermissions.teams.map((x: ResourcePermissions) => x.id) },
      },
    };
    const reportsQuery: any = {
      filter: {
        team_id: { $in: tokenPermissions.teams.map((x: ResourcePermissions) => x.id) },
      },
    };
    const discussionsQuery: any = {
      filter: {
        mark_delete_at: null,
        team_id: { $in: tokenPermissions.teams.map((x: ResourcePermissions) => x.id) },
      },
    };
    const teams: Team[] = await this.getTeams(teamsQuery);
    teams.forEach((team: Team) => {
      if (map.has(team.id)) {
        map.get(team.id).lastChange = moment.max(moment(team.updated_at), moment(map.get(team.id).lastChange)).toDate();
      }
    });
    const reports: Report[] = await this.reportsService.getReports(reportsQuery);
    const reportTeamMap: Map<string, string> = new Map<string, string>();
    reports.forEach((report: Report) => {
      reportTeamMap.set(report.id, report.team_id);
      if (!map.has(report.team_id)) {
        map.set(report.team_id, { members: 0, reports: 0, discussions: 0, comments: 0, lastChange: moment('1970-01-10').toDate() });
      }
      map.get(report.team_id).reports++;
      map.get(report.team_id).lastChange = moment.max(moment(report.updated_at), moment(map.get(report.team_id).lastChange)).toDate();
    });
    const discussions: Discussion[] = await this.discussionsService.getDiscussions(discussionsQuery);
    const discussionTeamMap: Map<string, string> = new Map<string, string>();
    discussions.forEach((discussion: Discussion) => {
      discussionTeamMap.set(discussion.id, discussion.team_id);
      if (!map.has(discussion.team_id)) {
        map.set(discussion.team_id, {
          members: 0,
          reports: 0,
          discussions: 0,
          comments: 0,
          lastChange: moment('1970-01-10').toDate(),
        });
      }
      map.get(discussion.team_id).discussions++;
      map.get(discussion.team_id).lastChange = moment.max(moment(discussion.updated_at), moment(map.get(discussion.team_id).lastChange)).toDate();
    });
    const commentsQuery: any = {
      filter: {
        $or: [],
      },
    };
    if (reports.length > 0) {
      commentsQuery.filter.$or.push({
        report_id: { $in: reports.map((report: Report) => report.id) },
      });
    }
    if (discussions.length > 0) {
      commentsQuery.filter.$or.push({
        discussion_id: { $in: discussions.map((discussion: Discussion) => discussion.id) },
      });
    }
    const comments: Comment[] = reports.length > 0 || discussions.length > 0 ? await this.commentsService.getComments(commentsQuery) : [];
    comments.forEach((comment: Comment) => {
      let teamId: string | null = null;
      if (discussionTeamMap.has(comment.discussion_id)) {
        teamId = discussionTeamMap.get(comment.discussion_id);
      } else if (reportTeamMap.has(comment.report_id)) {
        teamId = reportTeamMap.get(comment.report_id);
      }
      if (!teamId) {
        return;
      }
      if (!map.has(teamId)) {
        map.set(teamId, {
          members: 0,
          reports: 0,
          discussions: 0,
          comments: 0,
          lastChange: moment('1970-01-10').toDate(),
        });
      }
      map.get(teamId).comments++;
      map.get(teamId).lastChange = moment.max(moment(comment.updated_at), moment(map.get(teamId).lastChange)).toDate();
    });
    const inlineComments: InlineComment[] =
      reports.length > 0
        ? await this.inlineCommentsService.getInlineComments({
            filter: {
              report_id: {
                $in: reports.map((x: Report) => x.id),
              },
            },
          })
        : [];
    inlineComments.forEach((inlineComment: InlineComment) => {
      if (!reportTeamMap.has(inlineComment.report_id)) {
        return;
      }
      const teamId: string = reportTeamMap.get(inlineComment.report_id);
      if (!map.has(teamId)) {
        map.set(teamId, {
          members: 0,
          reports: 0,
          discussions: 0,
          comments: 0,
          lastChange: moment('1970-01-10').toDate(),
        });
      }
      map.get(teamId).comments++;
      map.get(teamId).lastChange = moment.max(moment(inlineComment.updated_at), moment(map.get(teamId).lastChange)).toDate();
    });
    map.forEach((value: { members: number; reports: number; discussions: number; comments: number; lastChange: Date; avatar_url: string }, teamId: string) => {
      const teamInfoDto: TeamInfoDto = new TeamInfoDto(teamId, value.members, value.reports, value.discussions, value.comments, value.lastChange);
      paginatedResponseDto.results.push(teamInfoDto);
    });
    return paginatedResponseDto;
  }

  public async deleteMemberInTeamsOfOrganization(organizationId: string, userId: string): Promise<void> {
    const teams: Team[] = await this.getTeams({
      filter: {
        organization_id: organizationId,
      },
    });
    if (teams.length === 0) {
      return;
    }
    await this.teamMemberProvider.deleteMany({
      team_id: {
        $in: teams.map((x: Team) => x.id),
      },
      member_id: userId,
    });
  }
}
