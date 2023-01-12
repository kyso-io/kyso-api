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
} from '@kyso-io/kyso-model';
import { ForbiddenException, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException, PreconditionFailedException, Provider } from '@nestjs/common';
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
import { CommentsService } from '../comments/comments.service';
import { DiscussionsService } from '../discussions/discussions.service';
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

  constructor(private readonly provider: TeamsMongoProvider, private readonly teamMemberProvider: TeamMemberMongoProvider, @Inject('NATS_SERVICE') private client: ClientProxy) {
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
  public async getTeamsVisibleForUser(userId: string): Promise<Team[]> {
    // All public teams
    const userTeamsResult: Team[] = await this.getTeams({ filter: { visibility: TeamVisibilityEnum.PUBLIC } });

    // All protected teams from organizations that the user belongs
    const allUserOrganizations: OrganizationMemberJoin[] = await this.organizationsService.searchMembersJoin({ filter: { member_id: userId } });

    for (const organizationMembership of allUserOrganizations) {
      const result = await this.getTeams({
        filter: {
          organization_id: organizationMembership.organization_id,
          visibility: TeamVisibilityEnum.PROTECTED,
        },
      });

      userTeamsResult.push(...result);
    }

    // All teams (whenever is public, private or protected) in which user is member
    const members: TeamMemberJoin[] = await this.searchMembers({ filter: { member_id: userId } });

    for (const m of members) {
      const result = await this.getTeam({ filter: { _id: this.provider.toObjectId(m.team_id) } });
      if (result) {
        userTeamsResult.push(result);
      }
    }

    const finalResult = [...new Set(userTeamsResult.filter((team) => !!team))];

    return finalResult;
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
    // return this.teamMemberProvider.read(query)
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

  async addMembers(teamName: string, members: User[], roles: KysoRole[]) {
    const team: Team = await this.getTeam({ filter: { name: teamName } });
    const memberIds = members.map((x) => x.id.toString());
    const rolesToApply = roles.map((y) => y.name);

    await this.addMembersById(team.id, memberIds, rolesToApply);
  }

  async addMembersById(teamId: string, memberIds: string[], rolesToApply: string[]): Promise<void> {
    const team: Team = await this.getTeamById(teamId);
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    const isCentralized: boolean = organization?.options?.notifications?.centralized || false;
    const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL);
    let emailsCentralized: string[] = [];
    if (isCentralized) {
      emailsCentralized = organization.options.notifications.emails;
    }
    for (const userId of memberIds) {
      const belongs: boolean = await this.userBelongsToTeam(teamId, userId);
      if (belongs) {
        continue;
      }
      const member: TeamMemberJoin = new TeamMemberJoin(teamId, userId, rolesToApply, true);
      await this.teamMemberProvider.create(member);
      const user: User = await this.usersService.getUserById(userId);
      NATSHelper.safelyEmit<KysoTeamsAddMemberEvent>(this.client, KysoEventEnum.TEAMS_ADD_MEMBER, {
        user,
        organization,
        team,
        emailsCentralized,
        frontendUrl,
        roles: rolesToApply,
      });
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
      users.sort((userA: User, userB: User) => {
        return userIds.indexOf(userA.id) - userIds.indexOf(userB.id);
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

  async createTeam(token: Token, team: Team): Promise<Team> {
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
        throw new PreconditionFailedException('The organization does not exist');
      }

      const users: User[] = await this.usersService.getUsers({ filter: { sluglified_name: team.sluglified_name } });
      if (users.length > 0) {
        throw new PreconditionFailedException('There is already a user with this sluglified_name');
      }

      team.user_id = token.id;
      const newTeam: Team = await this.provider.create(team);

      if (token) {
        await this.addMembersById(newTeam.id, [token.id], [PlatformRole.TEAM_ADMIN_ROLE.name]);

        NATSHelper.safelyEmit<KysoTeamsCreateEvent>(this.client, KysoEventEnum.TEAMS_CREATE, {
          user: await this.usersService.getUserById(token.id),
          organization,
          team: newTeam,
        });
      }
      return newTeam;
    } catch (e) {
      Logger.error(e);
    }
  }

  public async getReportsOfTeam(token: Token, teamId: string): Promise<Report[]> {
    const team: Team = await this.getTeamById(teamId);
    if (!team) {
      throw new PreconditionFailedException('Team not found');
    }
    const reports: Report[] = await this.reportsService.getReports({ filter: { team_id: team.id } });
    const userTeams: Team[] = await this.getTeamsVisibleForUser(token.id);
    const userInTeam: boolean = userTeams.find((x) => x.id === team.id) !== undefined;
    const members: OrganizationMemberJoin[] = await this.organizationsService.getMembers(team.organization_id);
    const userBelongsToOrganization: boolean = members.find((x: OrganizationMemberJoin) => x.member_id === token.id) !== undefined;
    const hasGlobalPermissionAdmin: boolean = userHasPermission(token, GlobalPermissionsEnum.GLOBAL_ADMIN);
    if (team.visibility === TeamVisibilityEnum.PUBLIC) {
      if (!userInTeam && !userBelongsToOrganization && !hasGlobalPermissionAdmin) {
        throw new PreconditionFailedException('You are not a member of this team and not of the organization');
      }
      return reports;
    } else if (team.visibility === TeamVisibilityEnum.PROTECTED) {
      if (!userInTeam && !userBelongsToOrganization) {
        throw new PreconditionFailedException('You are not a member of this team and not of the organization');
      }
      const userHasReportPermissionRead: boolean = userHasPermission(token, ReportPermissionsEnum.READ);
      const userHasReportPermissionAdmin: boolean = userHasPermission(token, ReportPermissionsEnum.ADMIN);
      if (!userHasReportPermissionRead && !userHasReportPermissionAdmin && !hasGlobalPermissionAdmin && !userBelongsToOrganization) {
        throw new PreconditionFailedException('User does not have permission to read reports');
      }
      return reports;
    } else if (team.visibility === TeamVisibilityEnum.PRIVATE) {
      if (!hasGlobalPermissionAdmin && !userInTeam) {
        throw new PreconditionFailedException('You are not a member of this team');
      }
      const userHasReportPermissionRead: boolean = userHasPermission(token, ReportPermissionsEnum.READ);
      const userHasReportPermissionAdmin: boolean = userHasPermission(token, ReportPermissionsEnum.ADMIN);
      if (!userHasReportPermissionRead && !userHasReportPermissionAdmin && !hasGlobalPermissionAdmin) {
        throw new PreconditionFailedException('User does not have permission to read reports');
      }
      return reports;
    }
    return [];
  }

  public async deleteGivenOrganization(token: Token, organization_id: string): Promise<void> {
    // Get all team  of the organization
    const teams: Team[] = await this.getTeams({ filter: { organization_id } });
    for (const team of teams) {
      await this.deleteTeam(token, team.id);
    }
  }

  public async getUserTeams(user_id: string): Promise<Team[]> {
    const userInTeams: TeamMemberJoin[] = await this.teamMemberProvider.read({ filter: { member_id: user_id } });
    return this.provider.read({ filter: { _id: { $in: userInTeams.map((x) => this.provider.toObjectId(x.team_id)) } } });
  }

  public async userBelongsToTeam(teamId: string, userId: string): Promise<boolean> {
    const team: Team = await this.getTeamById(teamId);
    if (!team) {
      throw new PreconditionFailedException('Team not found');
    }

    const user: User = await this.usersService.getUserById(userId);
    if (!user) {
      throw new PreconditionFailedException('User not found');
    }

    const members: TeamMember[] = await this.getMembers(team.id);
    const index: number = members.findIndex((member: TeamMember) => member.id === user.id);
    return index !== -1;
  }

  public async addMemberToTeam(teamId: string, userId: string, roles: KysoRole[]): Promise<TeamMember[]> {
    const userBelongsToTeam = await this.userBelongsToTeam(teamId, userId);
    if (userBelongsToTeam) {
      throw new PreconditionFailedException('User already belongs to this team');
    }
    const team: Team = await this.getTeamById(teamId);
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);

    if (!team) {
      throw new PreconditionFailedException('Team not found');
    }

    if (!organization) {
      throw new PreconditionFailedException("Team's organization not found");
    }

    const user: User = await this.usersService.getUserById(userId);
    if (!user) {
      throw new PreconditionFailedException('User not found');
    }
    await this.addMembersById(
      teamId,
      [user.id],
      roles.map((x) => x.name),
    );
    return this.getMembers(teamId);
  }

  public async removeMemberFromTeam(teamId: string, userId: string): Promise<TeamMember[]> {
    const team: Team = await this.getTeamById(teamId);
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);

    if (!team) {
      throw new PreconditionFailedException('Team not found');
    }

    if (!organization) {
      throw new PreconditionFailedException("Team's organization not found");
    }

    const user: User = await this.usersService.getUserById(userId);
    if (!user) {
      throw new PreconditionFailedException('User not found');
    }

    const members: TeamMemberJoin[] = await this.teamMemberProvider.read({ filter: { team_id: team.id } });
    const index: number = members.findIndex((x) => x.member_id === user.id);
    if (index === -1) {
      throw new PreconditionFailedException('User is not a member of this team');
    }

    await this.teamMemberProvider.deleteOne({ team_id: team.id, member_id: user.id });
    members.splice(index, 1);
    // SEND NOTIFICATIONS
    const isCentralized: boolean = organization?.options?.notifications?.centralized || false;
    const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL);
    let emailsCentralized: string[] = [];
    if (isCentralized) {
      emailsCentralized = organization.options.notifications.emails;
    }
    NATSHelper.safelyEmit<KysoTeamsRemoveMemberEvent>(this.client, KysoEventEnum.TEAMS_REMOVE_MEMBER, {
      user,
      organization,
      team,
      emailsCentralized,
      frontendUrl,
    });

    return this.getMembers(team.id);
  }

  public async updateTeamMembersDTORoles(teamId: string, data: UpdateTeamMembersDTO): Promise<TeamMember[]> {
    const team: Team = await this.getTeamById(teamId);
    if (!team) {
      throw new PreconditionFailedException('Team not found');
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    const isCentralized: boolean = organization?.options?.notifications?.centralized || false;
    const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL);
    let emailsCentralized: string[] = [];
    if (isCentralized) {
      emailsCentralized = organization.options.notifications.emails;
    }

    const members: TeamMemberJoin[] = await this.teamMemberProvider.getMembers(team.id);
    for (const element of data.members) {
      const user: User = await this.usersService.getUserById(element.userId);
      if (!user) {
        throw new PreconditionFailedException('User does not exist');
      }
      const member: TeamMemberJoin = members.find((x: TeamMemberJoin) => x.member_id === user.id);
      if (!member) {
        const member: TeamMemberJoin = new TeamMemberJoin(teamId, user.id, [element.role], true);
        await this.teamMemberProvider.create(member);
        NATSHelper.safelyEmit<KysoTeamsAddMemberEvent>(this.client, KysoEventEnum.TEAMS_ADD_MEMBER, {
          user,
          organization,
          team,
          emailsCentralized,
          frontendUrl,
          roles: [element.role],
        });
      } else {
        await this.teamMemberProvider.update({ _id: this.provider.toObjectId(member.id) }, { $set: { role_names: [element.role] } });
        NATSHelper.safelyEmit<KysoTeamsUpdateMemberRolesEvent>(this.client, KysoEventEnum.TEAMS_UPDATE_MEMBER_ROLES, {
          user,
          organization,
          team,
          emailsCentralized,
          frontendUrl,
          previousRoles: member.role_names,
          currentRoles: [element.role],
        });
      }
    }
    return this.getMembers(team.id);
  }

  public async removeTeamMemberRole(teamId: string, userId: string, role: string): Promise<TeamMember[]> {
    const team: Team = await this.getTeamById(teamId);
    if (!team) {
      throw new PreconditionFailedException('Team not found');
    }
    const user: User = await this.usersService.getUserById(userId);
    if (!user) {
      throw new PreconditionFailedException('User does not exist');
    }
    const members: TeamMemberJoin[] = await this.teamMemberProvider.getMembers(team.id);
    const member: TeamMemberJoin = members.find((x: TeamMemberJoin) => x.member_id === user.id);
    if (!member) {
      throw new PreconditionFailedException('User is not a member of this team');
    }
    const index: number = member.role_names.findIndex((x: string) => x === role);
    if (index === -1) {
      throw new PreconditionFailedException('User does not have this role');
    }
    await this.teamMemberProvider.update({ _id: this.provider.toObjectId(member.id) }, { $pull: { role_names: role } });
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

  public async deleteTeam(token: Token, teamId: string): Promise<Team> {
    const team: Team = await this.getTeamById(teamId);
    if (!team) {
      throw new PreconditionFailedException('Team not found');
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
    });
    return team;
  }

  public async uploadMarkdownImage(userId: string, teamId: string, file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new PreconditionFailedException('Missing image file');
    }
    const teams: Team[] = await this.getTeamsForController(userId, {});
    const team: Team = teams.find((t: Team) => t.id === teamId);
    if (!team) {
      throw new PreconditionFailedException(`You don't have permissions to upload markdown images to this team`);
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

  public async getTeamsInfo(token: Token, teamId?: string): Promise<TeamInfoDto[]> {
    const map: Map<string, { members: number; reports: number; discussions: number; comments: number; lastChange: Date }> = new Map<
      string,
      { members: number; reports: number; discussions: number; comments: number; lastChange: Date }
    >();
    if (token) {
      for (const teamResourcePermission of token.permissions.teams) {
        if (teamId && teamId.length > 0 && teamId !== teamResourcePermission.id) {
          continue;
        }
        if (!map.has(teamResourcePermission.id)) {
          const team: Team = await this.getTeamById(teamResourcePermission.id);
          const teamMembers: TeamMemberJoin[] = await this.teamMemberProvider.read({
            filter: {
              team_id: team.id,
            },
          });
          map.set(team.id, {
            members: teamMembers.length,
            reports: 0,
            discussions: 0,
            comments: 0,
            lastChange: team.updated_at,
          });
        }
      }
    } else {
      const teams: Team[] = await this.getTeams({
        filter: {
          visibility: TeamVisibilityEnum.PUBLIC,
        },
      });
      for (const team of teams) {
        if (teamId && teamId.length > 0 && teamId !== team.id) {
          continue;
        }
        if (!map.has(team.id)) {
          const teamMembers: TeamMemberJoin[] = await this.teamMemberProvider.read({
            filter: {
              team_id: team.id,
            },
          });
          map.set(team.id, {
            members: teamMembers.length,
            reports: 0,
            discussions: 0,
            comments: 0,
            lastChange: team.updated_at,
          });
        }
      }
    }
    let teams: Team[] = [];
    const teamsQuery: any = {
      filter: {},
    };
    const reportsQuery: any = {
      filter: {},
    };
    const discussionsQuery: any = {
      filter: {},
    };
    if (token) {
      if (teamId && teamId.length > 0) {
        teamsQuery.filter.id = teamId;
      }
      if (token.isGlobalAdmin()) {
        teams = await this.getTeams(teamsQuery);
      } else {
        teams = await this.getTeamsForController(token.id, teamsQuery);
        reportsQuery.filter = {
          team_id: {
            $in: teams.map((x: Team) => x.id),
          },
        };
        discussionsQuery.filter = {
          team_id: {
            $in: teams.map((x: Team) => x.id),
          },
        };
      }
    } else {
      if (teamId && teamId.length > 0) {
        if (!map.has(teamId)) {
          return [];
        } else {
          teamsQuery.filter.id = teamId;
          teamsQuery.filter.visibility = TeamVisibilityEnum.PUBLIC;
        }
      }
      teams = await this.getTeams(teamsQuery);
      if (teams.length === 0) {
        return [];
      }
      reportsQuery.filter = {
        team_id: {
          $in: teams.map((x: Team) => x.id),
        },
      };
      discussionsQuery.filter = {
        team_id: {
          $in: teams.map((x: Team) => x.id),
        },
      };
    }
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
      filter: {},
    };
    if (!token || (token && !token.isGlobalAdmin())) {
      commentsQuery.filter = {
        $or: [
          {
            report_id: { $in: reports.map((report: Report) => report.id) },
            discussion_id: { $in: discussions.map((discussion: Discussion) => discussion.id) },
          },
        ],
      };
    }
    const comments: Comment[] = await this.commentsService.getComments(commentsQuery);
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
    const inlineCommentsQuery: any = {
      filter: {
        report_id: {
          $in: reports.map((x: Report) => x.id),
        },
      },
    };
    const inlineComments: InlineComment[] = await this.inlineCommentsService.getInlineComments(inlineCommentsQuery);
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
    const result: TeamInfoDto[] = [];
    map.forEach((value: { members: number; reports: number; discussions: number; comments: number; lastChange: Date; avatar_url: string }, teamId: string) => {
      const teamInfoDto: TeamInfoDto = new TeamInfoDto(teamId, value.members, value.reports, value.discussions, value.comments, value.lastChange);
      result.push(teamInfoDto);
    });
    return result;
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
