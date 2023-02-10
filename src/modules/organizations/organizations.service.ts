import {
  AddUserOrganizationDto,
  AllowDownload,
  Comment,
  CreateOrganizationDto,
  Discussion,
  InlineComment,
  InviteUserDto,
  JoinCodes,
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
  UpdateJoinCodesDto,
  UpdateOrganizationDTO,
  UpdateOrganizationMembersDTO,
  User,
} from '@kyso-io/kyso-model';
import { BadRequestException, ForbiddenException, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException, PreconditionFailedException, Provider } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import axios, { AxiosResponse } from 'axios';
import * as moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { Autowired } from '../../decorators/autowired';
import { AutowiredService } from '../../generic/autowired.generic';
import { arrayEquals } from '../../helpers/array-equals';
import { NATSHelper } from '../../helpers/natsHelper';
import { PlatformRole } from '../../security/platform-roles';
import { ActivityFeedService } from '../activity-feed/activity-feed.service';
import { CommentsService } from '../comments/comments.service';
import { DiscussionsService } from '../discussions/discussions.service';
import { InlineCommentsService } from '../inline-comments/inline-comments.service';
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service';
import { ReportsService } from '../reports/reports.service';
import { SftpService } from '../reports/sftp.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
import { OrganizationMemberMongoProvider } from './providers/mongo-organization-member.provider';
import { OrganizationsMongoProvider } from './providers/mongo-organizations.provider';

function factory(service: OrganizationsService) {
  return service;
}

export function createProvider(): Provider<OrganizationsService> {
  return {
    provide: `${OrganizationsService.name}`,
    useFactory: (service) => factory(service),
    inject: [OrganizationsService],
  };
}

@Injectable()
export class OrganizationsService extends AutowiredService {
  @Autowired({ typeName: 'UsersService' })
  private usersService: UsersService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  @Autowired({ typeName: 'KysoSettingsService' })
  private kysoSettingsService: KysoSettingsService;

  @Autowired({ typeName: 'ReportsService' })
  private reportsService: ReportsService;

  @Autowired({ typeName: 'CommentsService' })
  private commentsService: CommentsService;

  @Autowired({ typeName: 'DiscussionsService' })
  private discussionsService: DiscussionsService;

  @Autowired({ typeName: 'InlineCommentsService' })
  private inlineCommentsService: InlineCommentsService;

  @Autowired({ typeName: 'ActivityFeedService' })
  private activityFeedService: ActivityFeedService;

  @Autowired({ typeName: 'SftpService' })
  private sftpService: SftpService;

  constructor(
    private readonly provider: OrganizationsMongoProvider,
    private readonly organizationMemberProvider: OrganizationMemberMongoProvider,
    @Inject('NATS_SERVICE') private client: ClientProxy,
  ) {
    super();
  }

  public async getOrganizations(query: any): Promise<Organization[]> {
    return await this.provider.read(query);
  }

  public async getOrganization(query: any): Promise<Organization> {
    const organization = await this.provider.read(query);
    if (organization.length === 0) {
      return null;
    }

    return organization[0];
  }

  public async getOrganizationById(id: string): Promise<Organization> {
    return this.getOrganization({ filter: { _id: this.provider.toObjectId(id) } });
  }

  public async getOrganizationBySlugName(organizationSlug: string): Promise<Organization> {
    return this.getOrganization({
      filter: {
        sluglified_name: organizationSlug,
      },
    });
  }

  public async createOrganization(token: Token, createOrganizationDto: CreateOrganizationDto, silent?: boolean): Promise<Organization> {
    const numOrganizationsCreatedByUser: number = await this.provider.count({ filter: { user_id: token.id } });
    const value: number = parseInt(await this.kysoSettingsService.getValue(KysoSettingsEnum.MAX_ORGANIZATIONS_PER_USER), 10);
    if (numOrganizationsCreatedByUser >= value) {
      throw new ForbiddenException('You have reached the maximum number of organizations you can create');
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
      createOrganizationDto.allow_download,
    );
    organization.options = new OrganizationOptions();

    // The name of this organization exists?
    const organizations: Organization[] = await this.provider.read({ filter: { display_name: organization.display_name } });

    if (organizations.length > 0) {
      const index: number = organizations.findIndex((org: Organization) => org.sluglified_name === organization.sluglified_name);
      if (index !== -1) {
        let i = 1;
        while (true) {
          const candidate_sluglified_name = `${organization.sluglified_name}-${i}`;
          const index: number = organizations.findIndex((org: Organization) => org.sluglified_name === candidate_sluglified_name);
          if (index === -1) {
            organization.sluglified_name = candidate_sluglified_name;
            break;
          }
          i++;
        }
      }
    }

    organization.user_id = token.id;
    const newOrganization: Organization = await this.provider.create(organization);

    if (!silent) {
      NATSHelper.safelyEmit<KysoOrganizationsCreateEvent>(this.client, KysoEventEnum.ORGANIZATIONS_CREATE, {
        user: await this.usersService.getUserById(token.id),
        organization: newOrganization,
      });
    }

    // Add user to his organization
    await this.addMembersById(newOrganization.id, [token.id], [PlatformRole.ORGANIZATION_ADMIN_ROLE.name]);

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
      createOrganizationDto.allow_download,
    );
    await this.teamsService.createTeam(token, generalTeam);

    return newOrganization;
  }

  public async deleteOrganization(token: Token, organizationId: string): Promise<Organization> {
    const organization: Organization = await this.getOrganizationById(organizationId);
    if (!organization) {
      throw new NotFoundException('Organization does not exist');
    }
    // Get organization members before deleting
    const organizationMembersJoin: OrganizationMemberJoin[] = await this.getMembers(organizationId);
    // Delete all teams of this organization
    await this.teamsService.deleteGivenOrganization(token, organization.id);
    // Delete all members of this organization
    await this.organizationMemberProvider.deleteMany({ organization_id: organization.id });
    // Delete all activity feed of this organization
    await this.activityFeedService.deleteActivityFeed({
      organization: organization.sluglified_name,
    });
    // Delete image
    await this.deleteProfilePicture(organizationId);
    // Delete the organization
    await this.provider.deleteOne({ _id: this.provider.toObjectId(organization.id) });
    NATSHelper.safelyEmit<KysoOrganizationsDeleteEvent>(this.client, KysoEventEnum.ORGANIZATIONS_DELETE, {
      user: await this.usersService.getUserById(token.id),
      organization,
      user_ids: organizationMembersJoin.map((member: OrganizationMemberJoin) => member.member_id),
    });
    return organization;
  }

  public async addMembers(organizationId: string, members: User[], roles: KysoRole[]): Promise<void> {
    const organization: Organization = await this.getOrganizationById(organizationId);
    if (!organization) {
      throw new PreconditionFailedException('Organization does not exist');
    }
    const memberIds: string[] = members.map((x) => x.id.toString());
    const rolesToApply: string[] = roles.map((y) => y.name);
    await this.addMembersById(organization.id, memberIds, rolesToApply);
  }

  public async addMembersById(organizationId: string, memberIds: string[], rolesToApply: string[]): Promise<void> {
    for (const memberId of memberIds) {
      const belongs: boolean = await this.userBelongsToOrganization(memberId, organizationId);
      if (belongs) {
        continue;
      }
      const member: OrganizationMemberJoin = new OrganizationMemberJoin(organizationId, memberId, rolesToApply, true);
      await this.organizationMemberProvider.create(member);
    }
  }

  public async userBelongsToOrganization(userId: string, organizationId: string): Promise<boolean> {
    const members: OrganizationMemberJoin[] = await this.searchMembersJoin({
      filter: { $and: [{ member_id: userId }, { organization_id: organizationId }] },
    });
    return members.length > 0;
  }

  public async searchMembersJoin(query: any): Promise<OrganizationMemberJoin[]> {
    // return this.organizationMemberProvider.read(query)
    const userOrganizationMembership: OrganizationMemberJoin[] = await this.organizationMemberProvider.read(query);
    const map: Map<string, OrganizationMemberJoin> = new Map<string, OrganizationMemberJoin>();
    for (const userOrganizationMember of userOrganizationMembership) {
      const key = `${userOrganizationMember.organization_id}-${userOrganizationMember.member_id}`;
      if (map.has(key)) {
        // User is in organization twice
        await this.organizationMemberProvider.deleteOne({ _id: this.provider.toObjectId(userOrganizationMember.id) });
        continue;
      }
      map.set(key, userOrganizationMember);
    }
    return Array.from(userOrganizationMembership.values());
  }

  /**
   * Return an array of user id's that belongs to provided organization
   */
  public async getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    const organization: Organization = await this.getOrganizationById(organizationId);
    if (organization) {
      // Get all the members of this organization
      const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id);

      // Build query object to retrieve all the users
      const user_ids = members.map((x: OrganizationMemberJoin) => {
        return x.member_id;
      });

      // Build the query to retrieve all the users
      const filterArray = [];
      user_ids.forEach((id: string) => {
        filterArray.push({ _id: this.provider.toObjectId(id) });
      });

      if (filterArray.length > 0) {
        const filter = { filter: { $or: filterArray } };

        const users = await this.usersService.getUsers(filter);

        const usersAndRoles = users.map((u: User) => {
          // Find role for this user in members
          const thisMember: OrganizationMemberJoin = members.find((tm: OrganizationMemberJoin) => u.id.toString() === tm.member_id);

          return { ...u, roles: thisMember.role_names };
        });

        return usersAndRoles.map((x) => new OrganizationMember(x.id.toString(), x.display_name, x.username, x.roles, x.bio, x.avatar_url, x.email));
      } else {
        return [];
      }
    } else {
      return [];
    }
  }

  public async updateOrganizationOptions(token: Token, organizationId: string, options: OrganizationOptions): Promise<Organization> {
    const organizationDb: Organization = await this.getOrganizationById(organizationId);
    if (!organizationDb) {
      throw new NotFoundException('Organization does not exist');
    }
    const organization: Organization = await this.provider.update(
      { _id: this.provider.toObjectId(organizationDb.id) },
      {
        $set: { options },
      },
    );
    if (organization.options.notifications.centralized && !arrayEquals(organizationDb.options.notifications.emails, organization.options.notifications.emails)) {
      NATSHelper.safelyEmit<KysoOrganizationsUpdateEvent>(this.client, KysoEventEnum.ORGANIZATIONS_UPDATE_CENTRALIZED_COMMUNICATIONS, {
        user: await this.usersService.getUserById(token.id),
        organization,
      });
    }
    NATSHelper.safelyEmit<KysoOrganizationsUpdateEvent>(this.client, KysoEventEnum.ORGANIZATIONS_UPDATE_OPTIONS, {
      user: await this.usersService.getUserById(token.id),
      organization,
    });
    return organization;
  }

  public async updateOrganization(token: Token, organizationId: string, updateOrganizationDto: UpdateOrganizationDTO): Promise<Organization> {
    let organization: Organization = await this.getOrganizationById(organizationId);
    if (!organization) {
      throw new PreconditionFailedException('Organization does not exist');
    }
    for (const key in updateOrganizationDto) {
      if (updateOrganizationDto[key] === undefined) {
        delete updateOrganizationDto[key];
      }
    }
    const data: any = {};
    if (updateOrganizationDto?.display_name) {
      data.display_name = updateOrganizationDto.display_name;
    }
    if (updateOrganizationDto.hasOwnProperty('location') && updateOrganizationDto.location !== null) {
      data.location = updateOrganizationDto.location;
    }
    if (updateOrganizationDto.hasOwnProperty('link') && updateOrganizationDto.link !== null) {
      data.link = updateOrganizationDto.link;
    }
    if (updateOrganizationDto.hasOwnProperty('bio') && updateOrganizationDto.bio !== null) {
      data.bio = updateOrganizationDto.bio;
    }
    if (updateOrganizationDto?.allowed_access_domains) {
      data.allowed_access_domains = updateOrganizationDto.allowed_access_domains || [];
    }
    if (updateOrganizationDto?.options && Object.keys(updateOrganizationDto.options).length > 0) {
      let orgNotifications: any = {};
      if (organization?.options?.notifications) {
        orgNotifications = { ...organization.options.notifications };
      }
      /* DEPRECATED
      let orgAuth: any = {};
      if (organization?.options?.auth) {
        orgAuth = { ...organization.options.auth };
      }
      */
      data.options = {};
      if (updateOrganizationDto?.options?.notifications && Object.keys(updateOrganizationDto.options.notifications).length > 0) {
        data.options.notifications = { ...orgNotifications, ...updateOrganizationDto.options.notifications };
      }
      /* DEPRECATED
      if (updateOrganizationDto?.options?.auth && Object.keys(updateOrganizationDto.options.auth).length > 0) {
        data.options.auth = { ...orgAuth, ...updateOrganizationDto.options.auth };
      }
      */
    }
    if (updateOrganizationDto?.allow_download && updateOrganizationDto.allow_download !== null) {
      if (updateOrganizationDto.allow_download === AllowDownload.INHERITED) {
        throw new BadRequestException('Inherited value is invalid for allow_download property at organization level');
      }
      data.allow_download = updateOrganizationDto.allow_download;
    }
    organization = await this.provider.update(
      { _id: this.provider.toObjectId(organization.id) },
      {
        $set: data,
      },
    );

    NATSHelper.safelyEmit<KysoOrganizationsUpdateEvent>(this.client, KysoEventEnum.ORGANIZATIONS_UPDATE, {
      user: await this.usersService.getUserById(token.id),
      organization,
    });

    return organization;
  }

  public async getMembers(organizationId: string): Promise<OrganizationMemberJoin[]> {
    return this.organizationMemberProvider.getMembers(organizationId);
  }

  public async addMemberToOrganization(addUserOrganizationDto: AddUserOrganizationDto): Promise<OrganizationMember[]> {
    const organization: Organization = await this.getOrganizationById(addUserOrganizationDto.organizationId);
    if (!organization) {
      throw new PreconditionFailedException('Organization does not exist');
    }

    const user: User = await this.usersService.getUserById(addUserOrganizationDto.userId);
    if (!user) {
      throw new PreconditionFailedException('User does not exist');
    }

    // Throws an exception if exists a domain restriction
    this.checkDomainRestrictionInOrganization(user.email, organization);

    const validRoles: string[] = [
      PlatformRole.TEAM_ADMIN_ROLE.name,
      PlatformRole.TEAM_CONTRIBUTOR_ROLE.name,
      PlatformRole.TEAM_READER_ROLE.name,
      PlatformRole.ORGANIZATION_ADMIN_ROLE.name,
      ...organization.roles.map((x: KysoRole) => x.name),
    ];
    if (!validRoles.includes(addUserOrganizationDto.role)) {
      throw new PreconditionFailedException('Invalid role');
    }
    const isCentralized: boolean = organization?.options?.notifications?.centralized || false;
    const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL);
    let emailsCentralized: string[] = [];

    const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id);
    const member: OrganizationMemberJoin = members.find((x: OrganizationMemberJoin) => x.member_id === user.id);
    if (member) {
      // Check if member has the role
      if (!member.role_names.includes(addUserOrganizationDto.role)) {
        member.role_names.push(addUserOrganizationDto.role);
        await this.organizationMemberProvider.updateOne({ _id: this.provider.toObjectId(member.id) }, { $set: { role_names: [member.role_names] } });

        try {
          if (isCentralized) {
            emailsCentralized = organization.options.notifications.emails;
          }

          NATSHelper.safelyEmit<KysoOrganizationsAddMemberEvent>(this.client, KysoEventEnum.ORGANIZATIONS_UPDATE_MEMBER_ROLE, {
            user,
            organization,
            emailsCentralized,
            role: addUserOrganizationDto.role,
            frontendUrl,
          });
        } catch (ex) {
          Logger.error('Error sending notifications of role change for an existing member in an organization', ex);
        }
      }
    } else {
      const newMember: OrganizationMemberJoin = new OrganizationMemberJoin(organization.id, user.id, [addUserOrganizationDto.role], true);
      await this.organizationMemberProvider.create(newMember);

      try {
        if (isCentralized) {
          emailsCentralized = organization.options.notifications.emails;
        }
        NATSHelper.safelyEmit<KysoOrganizationsAddMemberEvent>(this.client, KysoEventEnum.ORGANIZATIONS_ADD_MEMBER, {
          user,
          organization,
          emailsCentralized,
          role: addUserOrganizationDto.role,
          frontendUrl,
        });
      } catch (ex) {
        Logger.error('Error sending notifications of new member in an organization', ex);
      }
    }

    return this.getOrganizationMembers(organization.id);
  }

  public async addUserToOrganization(userId: string, organizationName: string, invitationCode: string): Promise<boolean> {
    const kysoSettingsValue: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ENABLE_INVITATION_LINKS_GLOBALLY);
    const enableInvitationLinksGlobally: boolean = kysoSettingsValue === 'true';
    if (!enableInvitationLinksGlobally) {
      throw new ForbiddenException('Invitation links are disabled globally');
    }
    const organization: Organization = await this.getOrganization({
      filter: {
        sluglified_name: organizationName,
      },
    });
    if (!organization) {
      throw new NotFoundException('Organization does not exist');
    }
    if (!organization.join_codes) {
      throw new ForbiddenException('The organization does not have defined invitatino links');
    }
    if (!organization.join_codes.enabled) {
      throw new ForbiddenException('The organization does not have invitation links activated');
    }
    if (moment().isAfter(organization.join_codes.valid_until)) {
      throw new ForbiddenException('Invitation link is expired');
    }
    let role: string;
    if (organization.join_codes.reader === invitationCode) {
      role = PlatformRole.TEAM_READER_ROLE.name;
    } else if (organization.join_codes.contributor === invitationCode) {
      role = PlatformRole.TEAM_CONTRIBUTOR_ROLE.name;
    } else {
      throw new BadRequestException('Invalid invitation code');
    }
    const user: User = await this.usersService.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User does not exist');
    }

    // Throws an exception if there is a restriction
    this.checkDomainRestrictionInOrganization(user.email, organization);

    const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id);
    let member: OrganizationMemberJoin = members.find((x: OrganizationMemberJoin) => x.member_id === user.id);
    if (member) {
      return true;
    }
    member = new OrganizationMemberJoin(organization.id, user.id, [role], true);
    await this.organizationMemberProvider.create(member);
    // SEND NOTIFICATIONS
    const isCentralized: boolean = organization?.options?.notifications?.centralized || false;
    const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL);
    let emailsCentralized: string[] = [];
    if (isCentralized) {
      emailsCentralized = organization.options.notifications.emails;
    }
    NATSHelper.safelyEmit<KysoOrganizationsAddMemberEvent>(this.client, KysoEventEnum.ORGANIZATIONS_ADD_MEMBER, {
      user,
      organization,
      emailsCentralized,
      role,
      frontendUrl,
    });
    return true;
  }

  public async removeMemberFromOrganization(organizationId: string, userId: string): Promise<OrganizationMember[]> {
    const organization: Organization = await this.getOrganizationById(organizationId);
    if (!organization) {
      throw new PreconditionFailedException('Organization does not exist');
    }

    const user: User = await this.usersService.getUserById(userId);
    if (!user) {
      throw new PreconditionFailedException('User does not exist');
    }

    const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id);
    const index: number = members.findIndex((x: OrganizationMemberJoin) => x.member_id === user.id);
    if (index === -1) {
      throw new PreconditionFailedException('User is not a member of this organization');
    }

    await this.organizationMemberProvider.deleteOne({ organization_id: organization.id, member_id: user.id });
    await this.teamsService.deleteMemberInTeamsOfOrganization(organization.id, user.id);

    // SEND NOTIFICATIONS
    const isCentralized: boolean = organization?.options?.notifications?.centralized || false;
    const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL);
    let emailsCentralized: string[] = [];
    if (isCentralized) {
      emailsCentralized = organization.options.notifications.emails;
    }
    NATSHelper.safelyEmit<KysoOrganizationsRemoveMemberEvent>(this.client, KysoEventEnum.ORGANIZATIONS_REMOVE_MEMBER, {
      user,
      organization,
      emailsCentralized,
      frontendUrl,
    });

    return this.getOrganizationMembers(organization.id);
  }

  public async updateOrganizationMembersDTORoles(organizationId: string, data: UpdateOrganizationMembersDTO): Promise<OrganizationMember[]> {
    const organization: Organization = await this.getOrganizationById(organizationId);
    if (!organization) {
      throw new PreconditionFailedException('Organization does not exist');
    }
    const isCentralized: boolean = organization?.options?.notifications?.centralized || false;
    const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL);
    let emailsCentralized: string[] = [];
    if (isCentralized) {
      emailsCentralized = organization.options.notifications.emails;
    }
    const validRoles: string[] = [
      PlatformRole.TEAM_ADMIN_ROLE.name,
      PlatformRole.TEAM_CONTRIBUTOR_ROLE.name,
      PlatformRole.TEAM_READER_ROLE.name,
      PlatformRole.ORGANIZATION_ADMIN_ROLE.name,
      ...organization.roles.map((x: KysoRole) => x.name),
    ];
    const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id);
    for (const element of data.members) {
      const user: User = await this.usersService.getUserById(element.userId);
      if (!user) {
        throw new PreconditionFailedException('User does not exist');
      }
      const member: OrganizationMemberJoin = members.find((x: OrganizationMemberJoin) => x.member_id === user.id);
      if (!member) {
        throw new PreconditionFailedException('User is not a member of this organization');
      }
      if (!validRoles.includes(element.role)) {
        throw new PreconditionFailedException(`Role ${element.role} is not valid`);
      }
      if (!member.role_names.includes(element.role)) {
        NATSHelper.safelyEmit<KysoOrganizationsAddMemberEvent>(this.client, KysoEventEnum.ORGANIZATIONS_UPDATE_MEMBER_ROLE, {
          user,
          organization,
          emailsCentralized,
          role: element.role,
          frontendUrl,
        });
      }
      await this.organizationMemberProvider.update({ _id: this.provider.toObjectId(member.id) }, { $set: { role_names: [element.role] } });
    }
    return this.getOrganizationMembers(organization.id);
  }

  public async removeOrganizationMemberRole(organizationId: string, userId: string, role: string): Promise<OrganizationMember[]> {
    const organization: Organization = await this.getOrganizationById(organizationId);
    if (!organization) {
      throw new PreconditionFailedException('Organization does not exist');
    }
    const user: User = await this.usersService.getUserById(userId);
    if (!user) {
      throw new PreconditionFailedException('User does not exist');
    }
    const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.getMembers(organization.id);
    const data: OrganizationMemberJoin = members.find((x: OrganizationMemberJoin) => x.member_id === user.id);
    if (!data) {
      throw new PreconditionFailedException('User is not a member of this organization');
    }
    const index: number = data.role_names.findIndex((x: string) => x === role);
    if (index === -1) {
      throw new PreconditionFailedException(`User does not have role ${role}`);
    }
    await this.organizationMemberProvider.update({ _id: this.provider.toObjectId(data.id) }, { $pull: { role_names: role } });
    return this.getOrganizationMembers(organization.id);
  }

  public async getUserOrganizations(userId: string): Promise<Organization[]> {
    const userInOrganizations: OrganizationMemberJoin[] = await this.organizationMemberProvider.read({ filter: { member_id: userId } });
    return this.provider.read({
      filter: { _id: { $in: userInOrganizations.map((x: OrganizationMemberJoin) => this.provider.toObjectId(x.organization_id)) } },
    });
  }

  public async setProfilePicture(organizationId: string, file: Express.Multer.File): Promise<Organization> {
    const organization: Organization = await this.getOrganizationById(organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    let avatar_url: string;
    try {
      avatar_url = await this.sftpService.uploadPublicFileFromPost(file);
    } catch (e) {
      Logger.error(`An error occurred while uploading the organization image`, e, OrganizationsService.name);
      throw new InternalServerErrorException('Error uploading organization image');
    }
    const scsPublicPrefix: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.STATIC_CONTENT_PUBLIC_PREFIX);
    if (!scsPublicPrefix) {
      Logger.error('STATIC_CONTENT_PUBLIC_PREFIX is not defined', OrganizationsService.name);
      throw new InternalServerErrorException('Error uploading file');
    }
    if (organization?.avatar_url && organization.avatar_url !== avatar_url && organization.avatar_url.startsWith(scsPublicPrefix)) {
      // Check if some entity is using the image
      const usersAvatarUrl: User[] = await this.usersService.getUsers({ filter: { avatar_url: organization.avatar_url } });
      const usersBackgroundUrl: User[] = await this.usersService.getUsers({ filter: { background_image_url: organization.avatar_url } });
      const organizations: Organization[] = await this.getOrganizations({
        filter: { avatar_url: organization.avatar_url, id: { $ne: organization.id } },
      });
      const teams: Team[] = await this.teamsService.getTeams({ filter: { avatar_url: organization.avatar_url } });
      const reports: Report[] = await this.reportsService.getReports({ filter: { preview_picture: organization.avatar_url } });
      if (usersAvatarUrl.length === 0 && usersBackgroundUrl.length === 0 && organizations.length === 0 && teams.length === 0 && reports.length === 0) {
        // Remove file from SFTP
        try {
          await this.sftpService.deletePublicFile(organization.avatar_url);
        } catch (e) {
          Logger.error(`An error occurred while deleting the organization image`, e, OrganizationsService.name);
        }
      }
    }
    return this.provider.update({ _id: this.provider.toObjectId(organization.id) }, { $set: { avatar_url } });
  }

  public async deleteProfilePicture(organizationId: string): Promise<Organization> {
    const organization: Organization = await this.getOrganizationById(organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    const scsPublicPrefix: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.STATIC_CONTENT_PUBLIC_PREFIX);
    if (organization?.avatar_url && organization.avatar_url.startsWith(scsPublicPrefix)) {
      // Check if some entity is using the image
      const usersAvatarUrl: User[] = await this.usersService.getUsers({ filter: { avatar_url: organization.avatar_url } });
      const usersBackgroundUrl: User[] = await this.usersService.getUsers({ filter: { background_image_url: organization.avatar_url } });
      const organizations: Organization[] = await this.getOrganizations({
        filter: { avatar_url: organization.avatar_url, id: { $ne: organization.id } },
      });
      const teams: Team[] = await this.teamsService.getTeams({ filter: { avatar_url: organization.avatar_url } });
      const reports: Report[] = await this.reportsService.getReports({ filter: { preview_picture: organization.avatar_url } });
      if (usersAvatarUrl.length === 0 && usersBackgroundUrl.length === 0 && organizations.length === 0 && teams.length === 0 && reports.length === 0) {
        // Remove file from SFTP
        try {
          await this.sftpService.deletePublicFile(organization.avatar_url);
        } catch (e) {
          Logger.error(`An error occurred while deleting the organization image`, e, OrganizationsService.name);
        }
      }
    }
    return this.provider.update({ _id: this.provider.toObjectId(organization.id) }, { $set: { avatar_url: null } });
  }

  public async getNumMembersAndReportsByOrganization(token: Token | null, organizationId: string): Promise<OrganizationInfoDto[]> {
    const map: Map<string, { members: number; reports: number; discussions: number; comments: number; lastChange: Date; avatar_url: string }> = new Map<
      string,
      { members: number; reports: number; discussions: number; comments: number; lastChange: Date; avatar_url: string }
    >();
    const query: any = {
      filter: {},
    };
    if (token && !token.isGlobalAdmin()) {
      query.filter.member_id = token.id;
    }
    if (organizationId && organizationId.length > 0) {
      query.filter.organization_id = organizationId;
    }
    const members: OrganizationMemberJoin[] = await this.organizationMemberProvider.read(query);
    for (const organizationMemberJoin of members) {
      if (!map.has(organizationMemberJoin.organization_id)) {
        const organization: Organization = await this.getOrganizationById(organizationMemberJoin.organization_id);
        if (!organization) {
          continue;
        }
        const members: OrganizationMember[] = await this.getOrganizationMembers(organization.id);
        map.set(organization.id, {
          members: members.length,
          reports: 0,
          discussions: 0,
          comments: 0,
          lastChange: organization.updated_at,
          avatar_url: organization.avatar_url,
        });
      }
    }
    const teamOrgMap: Map<string, string> = new Map<string, string>();
    let teams: Team[] = [];
    const teamsQuery: any = {
      filter: {},
    };
    const reportsQuery: any = {
      filter: {},
    };
    const discussionsQuery: any = {
      filter: {
        mark_delete_at: null,
      },
    };
    if (organizationId && organizationId.length > 0) {
      teamsQuery.filter.organization_id = organizationId;
    }
    if (!token) {
      if (organizationId) {
        teamsQuery.filter.organization_id = organizationId;
      }
      teamsQuery.filter.visibility = TeamVisibilityEnum.PUBLIC;
      teams = await this.teamsService.getTeams(teamsQuery);
      if (teams.length > 0) {
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
      } else {
        reportsQuery.filter = null;
      }
    } else if (token.isGlobalAdmin()) {
      teams = await this.teamsService.getTeams(teamsQuery);
    } else {
      teams = await this.teamsService.getTeamsForController(token.id, teamsQuery);
      if (teams.length > 0) {
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
      } else {
        reportsQuery.filter = null;
      }
    }
    teams.forEach((team: Team) => {
      teamOrgMap.set(team.id, team.organization_id);
      if (map.has(team.organization_id)) {
        map.get(team.organization_id).lastChange = moment.max(moment(team.updated_at), moment(map.get(team.organization_id).lastChange)).toDate();
      }
    });
    const reports: Report[] = reportsQuery.filter ? await this.reportsService.getReports(reportsQuery) : [];
    const mapReportOrg: Map<string, string> = new Map<string, string>();
    reports.forEach((report: Report) => {
      const organizationId: string | undefined = teamOrgMap.get(report.team_id);
      if (!organizationId) {
        return;
      }
      mapReportOrg.set(report.id, organizationId);
      if (!map.has(organizationId)) {
        map.set(organizationId, { members: 0, reports: 0, discussions: 0, comments: 0, lastChange: moment('1970-01-10').toDate(), avatar_url: null });
      }
      map.get(organizationId).reports++;
      map.get(organizationId).lastChange = moment.max(moment(report.updated_at), moment(map.get(organizationId).lastChange)).toDate();
    });
    const discussions: Discussion[] = discussionsQuery.filter ? await this.discussionsService.getDiscussions(discussionsQuery) : [];
    const mapDiscussionOrg: Map<string, string> = new Map<string, string>();
    discussions.forEach((discussion: Discussion) => {
      const organizationId: string | undefined = teamOrgMap.get(discussion.team_id);
      if (!organizationId) {
        return;
      }
      mapDiscussionOrg.set(discussion.id, organizationId);
      if (!map.has(organizationId)) {
        map.set(organizationId, {
          members: 0,
          reports: 0,
          discussions: 0,
          comments: 0,
          lastChange: moment('1970-01-10').toDate(),
          avatar_url: null,
        });
      }
      map.get(organizationId).discussions++;
      map.get(organizationId).lastChange = moment.max(moment(discussion.updated_at), moment(map.get(organizationId).lastChange)).toDate();
    });
    const commentsQuery: any = {
      filter: {},
    };
    if (!token || !token.isGlobalAdmin()) {
      commentsQuery.filter = {
        $or: [],
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
      if (reports.length === 0 && discussions.length === 0) {
        commentsQuery.filter = null;
      }
    }
    const comments: Comment[] = commentsQuery.filter ? await this.commentsService.getComments(commentsQuery) : [];
    comments.forEach((comment: Comment) => {
      let organizationId: string | null;
      if (comment.report_id) {
        organizationId = mapReportOrg.get(comment.report_id);
      } else if (comment.discussion_id) {
        organizationId = mapReportOrg.get(comment.discussion_id);
      }
      if (!organizationId) {
        return;
      }
      if (!map.has(organizationId)) {
        map.set(organizationId, {
          members: 0,
          reports: 0,
          discussions: 0,
          comments: 0,
          lastChange: moment('1970-01-10').toDate(),
          avatar_url: null,
        });
      }
      map.get(organizationId).comments++;
      map.get(organizationId).lastChange = moment.max(moment(comment.updated_at), moment(map.get(organizationId).lastChange)).toDate();
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
      if (!mapReportOrg.has(inlineComment.report_id)) {
        return;
      }
      const organizationId: string = mapReportOrg.get(inlineComment.report_id);
      if (!map.has(organizationId)) {
        map.set(organizationId, { members: 0, reports: 0, discussions: 0, comments: 0, lastChange: moment('1970-01-10').toDate(), avatar_url: null });
      }
      map.get(organizationId).comments++;
      map.get(organizationId).lastChange = moment.max(moment(inlineComment.updated_at), moment(map.get(organizationId).lastChange)).toDate();
    });
    const result: OrganizationInfoDto[] = [];
    map.forEach((value: { members: number; reports: number; discussions: number; comments: number; lastChange: Date; avatar_url: string }, organizationId: string) => {
      const organizationInfoDto: OrganizationInfoDto = new OrganizationInfoDto(organizationId, value.members, value.reports, value.discussions, value.comments, value.lastChange, value.avatar_url);
      result.push(organizationInfoDto);
    });
    return result;
  }

  public async getOrganizationStorage(user: Token, sluglified_name: string): Promise<OrganizationStorageDto> {
    const organization: Organization = await this.getOrganization({ filter: { sluglified_name } });
    if (!organization) {
      Logger.log(`Organization ${sluglified_name} not found`);
      throw new NotFoundException(`Organization ${sluglified_name} not found`);
    }
    let isOrgAdmin = false;
    if (!user.isGlobalAdmin()) {
      const resourcePermissionOrg: ResourcePermissions = user.permissions.organizations.find((x: ResourcePermissions) => x.id === organization.id);
      if (resourcePermissionOrg) {
        isOrgAdmin = resourcePermissionOrg.role_names.indexOf(PlatformRole.ORGANIZATION_ADMIN_ROLE.name) > -1;
      }
    }
    const resourcePermissionTeams: ResourcePermissions[] = user.permissions.teams.filter(
      (x: ResourcePermissions) => x.organization_id === organization.id && x.role_names.indexOf(PlatformRole.TEAM_ADMIN_ROLE.name) > -1,
    );

    let data: OrganizationStorageDto;
    try {
      const kysoIndexerApi: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.KYSO_INDEXER_API_BASE_URL);
      const url = `${kysoIndexerApi}/api/storage?organizationFolderPath=/sftp/data/scs/${sluglified_name}`;

      Logger.log(`Calling ${url}`);
      const axiosResponse: AxiosResponse<OrganizationStorageDto> = await axios.get<OrganizationStorageDto>(url);
      data = axiosResponse.data;
    } catch (e: any) {
      Logger.error('Unexpected error', e);
      throw new InternalServerErrorException(e.message);
    }

    const organizationStorageDto: OrganizationStorageDto = new OrganizationStorageDto(sluglified_name, 0, 0, 0);
    organizationStorageDto.name = sluglified_name;
    for (const storageTeam of data.teams) {
      const indexTeam: number = resourcePermissionTeams.findIndex((x: ResourcePermissions) => x.name === storageTeam.name);
      if (user.isGlobalAdmin() || isOrgAdmin || indexTeam > -1) {
        organizationStorageDto.teams.push(storageTeam);
      }
    }
    organizationStorageDto.consumedSpaceKb = organizationStorageDto.teams.reduce((acc: number, cur: StorageDto) => acc + cur.consumedSpaceKb, 0);
    organizationStorageDto.consumedSpaceMb = organizationStorageDto.teams.reduce((acc: number, cur: StorageDto) => acc + cur.consumedSpaceMb, 0);
    organizationStorageDto.consumedSpaceGb = organizationStorageDto.teams.reduce((acc: number, cur: StorageDto) => acc + cur.consumedSpaceGb, 0);

    return organizationStorageDto;
  }

  public async getOrganizationReports(token: Token, organizationSlug: string, page: number, limit: number, sort: string): Promise<PaginatedResponseDto<ReportDTO>> {
    const organization: Organization = await this.getOrganization({ filter: { sluglified_name: organizationSlug } });
    if (!organization) {
      Logger.log(`Organization ${organizationSlug} not found`);
      throw new NotFoundException(`Organization ${organizationSlug} not found`);
    }
    let teams: Team[] = [];
    if (token) {
      teams = await this.teamsService.getTeamsVisibleForUser(token.id);
      if (teams.length > 0) {
        teams = teams.filter((x: Team) => x.organization_id === organization.id);
      } else {
        teams = await this.teamsService.getTeams({ filter: { organization_id: organization.id, visibility: TeamVisibilityEnum.PUBLIC } });
      }
    } else {
      teams = await this.teamsService.getTeams({ filter: { organization_id: organization.id, visibility: TeamVisibilityEnum.PUBLIC } });
    }
    const query: any = {
      filter: {
        team_id: { $in: teams.map((x: Team) => x.id) },
      },
    };
    const totalItems: number = await this.reportsService.countReports(query);

    query.limit = limit;
    query.skip = (page - 1) * limit;
    query.sort = {
      pin: -1,
      created_at: -1,
    };
    if (sort) {
      let key: string = sort;
      let value = 1;
      if (sort.indexOf('-') === 0) {
        key = sort.substring(1);
        value = -1;
      }
      query.sort[key] = value;
    }

    const totalPages: number = Math.ceil(totalItems / limit);
    const reports: Report[] = await this.reportsService.getReports(query);
    const results: ReportDTO[] = await Promise.all(reports.map((report: Report) => this.reportsService.reportModelToReportDTO(report, token?.id)));
    const paginatedResponseDto: PaginatedResponseDto<ReportDTO> = new PaginatedResponseDto<ReportDTO>(page, results.length, Math.min(query.limit, results.length), results, totalItems, totalPages);
    return paginatedResponseDto;
  }

  public async inviteNewUser(token: Token, inviteUserDto: InviteUserDto): Promise<{ organizationMembers: OrganizationMember[]; teamMembers: TeamMember[] }> {
    const organization: Organization = await this.getOrganization({ filter: { sluglified_name: inviteUserDto.organizationSlug } });
    if (!organization) {
      Logger.log(`Organization ${inviteUserDto.organizationSlug} not found`);
      throw new NotFoundException(`Organization ${inviteUserDto.organizationSlug} not found`);
    }
    const permissionOrg: ResourcePermissions | undefined = token.permissions.organizations.find((x: ResourcePermissions) => x.id === organization.id);
    if (!permissionOrg) {
      Logger.log(`User ${token.id} is not authorized to invite users to organization ${inviteUserDto.organizationSlug}`);
      throw new ForbiddenException(`User ${token.id} is not authorized to invite users to organization ${inviteUserDto.organizationSlug}`);
    }

    if (!inviteUserDto.teamSlug) {
      const isOrgAdmin: boolean = permissionOrg.permissions.includes(OrganizationPermissionsEnum.ADMIN);
      if (!token.isGlobalAdmin() && !isOrgAdmin) {
        Logger.log(`User ${token.id} is not authorized to invite users to organization ${inviteUserDto.organizationSlug}`);
        throw new ForbiddenException(`User ${token.id} is not authorized to invite users to organization ${inviteUserDto.organizationSlug}`);
      }
    }

    // Throws a exception if there is a domain restriction
    this.checkDomainRestrictionInOrganization(inviteUserDto.email, organization);

    let user: User = await this.usersService.getUser({ filter: { email: inviteUserDto.email } });
    if (user) {
      Logger.log(`User ${inviteUserDto.email} already exists`);
      throw new BadRequestException(`User ${inviteUserDto.email} already exists`);
    }
    const signUpDto: SignUpDto = new SignUpDto(inviteUserDto.email, inviteUserDto.email, inviteUserDto.email, uuidv4());
    user = await this.usersService.createUser(signUpDto);

    await this.addMembersById(organization.id, [user.id], [inviteUserDto.organizationRole]);

    const result: { organizationMembers: OrganizationMember[]; teamMembers: TeamMember[] } = {
      organizationMembers: await this.getOrganizationMembers(organization.id),
      teamMembers: [],
    };

    if (inviteUserDto?.teamSlug) {
      const team: Team = await this.teamsService.getTeam({ filter: { organization_id: organization.id, sluglified_name: inviteUserDto.teamSlug } });
      if (!team) {
        Logger.log(`Team ${inviteUserDto.teamSlug} not found`);
        throw new NotFoundException(`Team ${inviteUserDto.teamSlug} not found`);
      }
      await this.teamsService.addMembersById(team.id, [user.id], [inviteUserDto.teamRole]);
      result.teamMembers = await this.teamsService.getMembers(team.id);
    }

    return result;
  }

  public async createJoinCodes(organizationId: string, updateJoinCodesDto: UpdateJoinCodesDto): Promise<JoinCodes> {
    const kysoSettingsValue: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ENABLE_INVITATION_LINKS_GLOBALLY);
    const enableInvitationLinksGlobally: boolean = kysoSettingsValue === 'true';
    if (!enableInvitationLinksGlobally) {
      throw new ForbiddenException('Invitation links are not enabled');
    }
    const validUntil: moment.Moment = moment(updateJoinCodesDto.valid_until).startOf('day');
    if (validUntil.isAfter(moment().add(2, 'months').startOf('day'))) {
      throw new BadRequestException('Expiration date can not be higher than 3 months');
    }
    const organization: Organization = await this.getOrganizationById(organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    const joinCodes: JoinCodes = new JoinCodes(uuidv4(), uuidv4(), updateJoinCodesDto.enabled, validUntil.toDate());
    await this.provider.updateOne({ _id: this.provider.toObjectId(organizationId) }, { $set: { join_codes: joinCodes } });
    return joinCodes;
  }

  public async updateJoinCodes(organizationId: string, updateJoinCodesDto: UpdateJoinCodesDto): Promise<JoinCodes> {
    const kysoSettingsValue: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ENABLE_INVITATION_LINKS_GLOBALLY);
    const enableInvitationLinksGlobally: boolean = kysoSettingsValue === 'true';
    if (!enableInvitationLinksGlobally) {
      throw new ForbiddenException('Invitation links are not enabled');
    }
    const validUntil: moment.Moment = moment(updateJoinCodesDto.valid_until).startOf('day');
    if (validUntil.isAfter(moment().add(2, 'months').startOf('day'))) {
      throw new BadRequestException('Expiration date can not be higher than 3 months');
    }
    const organization: Organization = await this.getOrganizationById(organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (!organization.join_codes) {
      throw new NotFoundException(`Organization ${organization.sluglified_name} has not defined join codes`);
    }
    const joinCodes: JoinCodes = organization.join_codes;
    joinCodes.enabled = updateJoinCodesDto.enabled;
    joinCodes.valid_until = moment(updateJoinCodesDto.valid_until).toDate();
    await this.provider.updateOne({ _id: this.provider.toObjectId(organizationId) }, { $set: { join_codes: joinCodes } });
    return joinCodes;
  }

  public checkDomainRestriction(userEmail: string, allowedAccessDomains: string[]) {
    if (allowedAccessDomains && Array.isArray(allowedAccessDomains) && allowedAccessDomains.length > 0) {
      // There is a restriction based on domain
      const splittedEmail: string[] = userEmail.split('@');
      const domain = splittedEmail && splittedEmail.length >= 2 ? splittedEmail[1] : null;

      if (domain) {
        const found: string[] = allowedAccessDomains.filter((x) => domain.toLowerCase().endsWith(x.toLowerCase()));

        if (!found) {
          // The invitation don't have an allowed domain
          throw new BadRequestException(`${userEmail} is an invalid domain. Allowed domains are ${allowedAccessDomains}`);
        }
      } else {
        throw new BadRequestException(`Can't extract the domain of ${userEmail}`);
      }
    }
  }

  public checkDomainRestrictionInOrganization(userEmail: string, organization: Organization) {
    return this.checkDomainRestriction(userEmail, organization.allowed_access_domains);
  }
}
