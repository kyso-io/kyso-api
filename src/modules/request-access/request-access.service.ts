import {
  AddUserOrganizationDto,
  KysoEventEnum,
  KysoOrganizationRequestAccessCreatedEvent,
  KysoSettingsEnum,
  KysoTeamRequestAccessCreatedEvent,
  Organization,
  OrganizationMemberJoin,
  RequestAccess,
  RequestAccessStatusEnum,
  Team,
  TeamMember,
  User,
} from '@kyso-io/kyso-model';
import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, PreconditionFailedException, Provider } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { isArray } from 'class-validator';
import { Autowired } from 'src/decorators/autowired';
import { NATSHelper } from 'src/helpers/natsHelper';
import { PlatformRole } from 'src/security/platform-roles';
import { AutowiredService } from '../../generic/autowired.generic';
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
import { RequestAccessMongoProvider } from './providers/request-access.provider';

function factory(service: RequestAccessService) {
  return service;
}

export function createProvider(): Provider<RequestAccessService> {
  return {
    provide: `${RequestAccessService.name}`,
    useFactory: (service) => factory(service),
    inject: [RequestAccessService],
  };
}

@Injectable()
export class RequestAccessService extends AutowiredService {
  @Autowired({ typeName: 'UsersService' })
  private usersService: UsersService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  @Autowired({ typeName: 'OrganizationsService' })
  private organizationsService: OrganizationsService;

  @Autowired({ typeName: 'KysoSettingsService' })
  private kysoSettingsService: KysoSettingsService;

  constructor(private readonly provider: RequestAccessMongoProvider, @Inject('NATS_SERVICE') private client: ClientProxy) {
    super();
  }

  public async requestAccessToOrganization(requester_user_id: string, organizationSlug: string): Promise<RequestAccess> {
    Logger.log(`User ${requester_user_id} requesting access to organization '${organizationSlug}'`);

    const requesterUser: User = await this.usersService.getUserById(requester_user_id);
    if (!requesterUser) {
      throw new BadRequestException(`Invalid user provided`);
    }

    const organization: Organization = await this.organizationsService.getOrganizationBySlugName(organizationSlug);
    if (!organization) {
      throw new NotFoundException(`Organization '${organizationSlug}' not found`);
    }

    const allMembers: OrganizationMemberJoin[] = await this.organizationsService.getMembers(organization.id);

    const onlyAdmins: OrganizationMemberJoin[] = allMembers.filter((x) => x.role_names.includes(PlatformRole.ORGANIZATION_ADMIN_ROLE.name));

    if (onlyAdmins && onlyAdmins.length > 0) {
      const allAdmins: User[] = [];

      // Process admins
      for (const orgAdmin of onlyAdmins) {
        try {
          const user: User = await this.usersService.getUserById(orgAdmin.member_id);

          allAdmins.push(user);
        } catch (ex) {
          Logger.warn(`Cant retrieve data from user ${orgAdmin.member_id}`);
        }
      }

      if (allAdmins.length > 0) {
        const requestAccess: RequestAccess = new RequestAccess(requester_user_id, organization.id, null, RequestAccessStatusEnum.PENDING, null, null);
        const result: RequestAccess = await this.provider.create(requestAccess);

        NATSHelper.safelyEmit<KysoOrganizationRequestAccessCreatedEvent>(this.client, KysoEventEnum.ORGANIZATION_REQUEST_ACCESS_CREATED, {
          request: result,
          organization,
          requesterUser,
          organizationAdmins: allAdmins,
          frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
        });

        return result;
      } else {
        throw new PreconditionFailedException('No administrator admins found for this organization');
      }
    } else {
      throw new PreconditionFailedException('No administrator admins defined for this organization');
    }
  }

  public async requestAccessToTeam(requester_user_id: string, organizationSlug: string, teamSlug: string): Promise<RequestAccess> {
    Logger.log(`User ${requester_user_id} requesting access to team ${teamSlug} in organization '${organizationSlug}'`);

    const requesterUser: User = await this.usersService.getUserById(requester_user_id);
    if (!requesterUser) {
      throw new BadRequestException(`Invalid user provided`);
    }

    const organization: Organization = await this.organizationsService.getOrganizationBySlugName(organizationSlug);
    if (!organization) {
      throw new NotFoundException(`Organization '${organizationSlug}' not found`);
    }

    const team: Team = await this.teamsService.getUniqueTeam(organization.id, teamSlug);
    if (!team) {
      throw new BadRequestException(`Invalid team provided`);
    }

    // Look for team admins at organization level
    const allMembers: OrganizationMemberJoin[] = await this.organizationsService.getMembers(team.organization_id);
    const onlyAdminsAtOrgLevel = allMembers.filter((x) => x.role_names.includes(PlatformRole.TEAM_ADMIN_ROLE.name));

    // Look for team admins at team level
    const allDirectTeamMembers: TeamMember[] = await this.teamsService.getMembers(team.id);
    const onlyAdminsAtTeamLevel = allDirectTeamMembers.filter((x) => x.team_roles.includes(PlatformRole.TEAM_ADMIN_ROLE.name));

    const onlyAdmins = [...onlyAdminsAtOrgLevel.map((x) => x.id), ...onlyAdminsAtTeamLevel.map((x) => x.id)];

    if (onlyAdmins && onlyAdmins.length > 0) {
      const allTeamAdmins: User[] = [];

      // Process admins
      for (const teamAdminId of onlyAdmins) {
        try {
          const user: User = await this.usersService.getUserById(teamAdminId);

          allTeamAdmins.push(user);
        } catch (ex) {
          Logger.warn(`Cant retrieve data from user ${teamAdminId}`);
        }
      }

      if (allTeamAdmins.length > 0) {
        const requestAccess: RequestAccess = new RequestAccess(requester_user_id, null, team.id, RequestAccessStatusEnum.PENDING, null, null);

        const result = await this.provider.create(requestAccess);

        NATSHelper.safelyEmit<KysoTeamRequestAccessCreatedEvent>(this.client, KysoEventEnum.TEAMS_REQUEST_ACCESS_CREATED, {
          request: result,
          organization,
          team,
          requesterUser,
          organizationAdmins: allTeamAdmins,
          frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
        });

        return result;
      } else {
        throw new PreconditionFailedException('No administrator admins found for this organization');
      }
    }
  }

  public async acceptOrganizationRequest(organization_id: string, requestId: string, role: string, secret: string, accepter_id: string): Promise<RequestAccess> {
    const request: RequestAccess[] = await this.provider.read({ filter: { id: requestId } });
    const accepterUser: User = await this.usersService.getUserById(accepter_id);

    if (request[0].organization_id !== organization_id) {
      throw new ForbiddenException(`Organization identifiers mismatch`);
    }

    if (role !== PlatformRole.TEAM_READER_ROLE.name && role !== PlatformRole.TEAM_CONTRIBUTOR_ROLE.name) {
      throw new BadRequestException(`Invalid role provided. Only reader and contributor roles are permitted`);
    }

    if (!accepterUser) {
      throw new BadRequestException(`Invalid user provided`);
    }

    if (!request || !isArray(request) || request.length === 0) {
      throw new BadRequestException(`Invalid request provided`);
    }

    if (request[0].secret !== secret) {
      throw new ForbiddenException(`Secrets missmatch`);
    }

    const organization = await this.organizationsService.getOrganizationById(request[0].organization_id);
    if (!organization) {
      throw new BadRequestException(`Request access organization no longer exists`);
    }

    // Add requester to organization as role
    const addUserToOrg: AddUserOrganizationDto = new AddUserOrganizationDto(request[0].organization_id, request[0].requester_user_id, role);

    await this.organizationsService.addMemberToOrganization(addUserToOrg);

    // Update the request
    let finalStatus = RequestAccessStatusEnum.PENDING;
    if (role !== PlatformRole.TEAM_READER_ROLE.name) {
      finalStatus = RequestAccessStatusEnum.ACCEPTED_AS_READER;
    }

    if (role !== PlatformRole.TEAM_CONTRIBUTOR_ROLE.name) {
      finalStatus = RequestAccessStatusEnum.ACCEPTED_AS_CONTRIBUTOR;
    }

    return this.provider.update(
      { _id: this.provider.toObjectId(requestId) },
      {
        $set: {
          resolved_at: new Date(),
          resolved_by: accepterUser.display_name,
          status: finalStatus,
        },
      },
    );
  }

  public async acceptTeamRequest(teamId: string, requestId: string, role: string, secret: string, accepter_id: string): Promise<RequestAccess> {
    const request: RequestAccess[] = await this.provider.read({ filter: { id: requestId } });
    const accepterUser: User = await this.usersService.getUserById(accepter_id);

    if (request[0].channel_id !== teamId) {
      throw new ForbiddenException(`Channels identifiers mismatch`);
    }

    if (role !== PlatformRole.TEAM_READER_ROLE.name && role !== PlatformRole.TEAM_CONTRIBUTOR_ROLE.name) {
      throw new BadRequestException(`Invalid role provided. Only reader and contributor roles are permitted`);
    }

    if (!accepterUser) {
      throw new BadRequestException(`Invalid user provided`);
    }

    if (!request || !isArray(request) || request.length === 0) {
      throw new BadRequestException(`Invalid request provided`);
    }

    if (request[0].secret !== secret) {
      throw new ForbiddenException(`Secrets missmatch`);
    }

    const team: Team = await this.teamsService.getTeamById(request[0].channel_id);
    if (!team) {
      throw new BadRequestException(`Request access team no longer exists`);
    }

    // add requester to team as specified role

    // Update the request
    let finalStatus = RequestAccessStatusEnum.PENDING;
    let kysoRole = PlatformRole.TEAM_READER_ROLE;

    if (role === PlatformRole.TEAM_READER_ROLE.name) {
      finalStatus = RequestAccessStatusEnum.ACCEPTED_AS_READER;
      kysoRole = PlatformRole.TEAM_READER_ROLE;
    } else if (role === PlatformRole.TEAM_CONTRIBUTOR_ROLE.name) {
      finalStatus = RequestAccessStatusEnum.ACCEPTED_AS_CONTRIBUTOR;
      kysoRole = PlatformRole.TEAM_CONTRIBUTOR_ROLE;
    }

    await this.teamsService.addMemberToTeam(request[0].channel_id, request[0].requester_user_id, [kysoRole]);

    // Add requester to organization as reader (fixed)
    const addUserToOrg: AddUserOrganizationDto = new AddUserOrganizationDto(team.organization_id, request[0].requester_user_id, PlatformRole.TEAM_READER_ROLE.name);
    await this.organizationsService.addMemberToOrganization(addUserToOrg);

    // Finally, update the request
    return this.provider.update(
      { _id: this.provider.toObjectId(requestId) },
      {
        $set: {
          resolved_at: new Date(),
          resolved_by: accepterUser.display_name,
          status: finalStatus,
        },
      },
    );
  }

  public async rejectOrganizationRequest(organizationId: string, requestId: string, secret: string, rejecter_id: string): Promise<RequestAccess> {
    const request: RequestAccess[] = await this.provider.read({ filter: { id: requestId } });
    const rejecterUser: User = await this.usersService.getUserById(rejecter_id);
    const requesterUser: User = await this.usersService.getUserById(request[0].requester_user_id);
    const organization: Organization = await this.organizationsService.getOrganizationById(request[0].organization_id);

    if (!rejecterUser) {
      throw new BadRequestException(`Invalid user provided`);
    }

    if (!request || !isArray(request) || request.length === 0) {
      throw new BadRequestException(`Invalid request provided`);
    }

    if (request[0].organization_id !== organizationId) {
      throw new ForbiddenException(`Organization identifiers mismatch`);
    }

    NATSHelper.safelyEmit<any>(this.client, KysoEventEnum.ORGANIZATION_REQUEST_ACCESS_REJECTED, {
      organization,
      requesterUser,
      rejecterUser,
      frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
    });

    return this.rejectRequest(request[0], secret, rejecterUser);
  }

  public async rejectTeamRequest(teamId: string, requestId: string, secret: string, rejecter_id: string): Promise<RequestAccess> {
    const request: RequestAccess[] = await this.provider.read({ filter: { id: requestId } });
    const rejecterUser: User = await this.usersService.getUserById(rejecter_id);
    const requesterUser: User = await this.usersService.getUserById(request[0].requester_user_id);
    const team: Team = await this.teamsService.getTeamById(request[0].channel_id);
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);

    if (!rejecterUser) {
      throw new BadRequestException(`Invalid user provided`);
    }

    if (!request || !isArray(request) || request.length === 0) {
      throw new BadRequestException(`Invalid request provided`);
    }

    if (request[0].channel_id !== teamId) {
      throw new ForbiddenException(`Channel identifiers mismatch`);
    }

    NATSHelper.safelyEmit<any>(this.client, KysoEventEnum.TEAMS_REQUEST_ACCESS_REJECTED, {
      organization,
      team,
      requesterUser,
      rejecterUser,
      frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
    });

    return this.rejectRequest(request[0], secret, rejecterUser);
  }

  private async rejectRequest(request: RequestAccess, secret: string, rejecterUser: User): Promise<RequestAccess> {
    if (request.secret !== secret) {
      throw new ForbiddenException(`Secrets missmatch`);
    }

    // Update the request
    return this.provider.update(
      { _id: this.provider.toObjectId(request.id) },
      {
        $set: {
          resolved_at: new Date(),
          resolved_by: rejecterUser.display_name,
          status: RequestAccessStatusEnum.REJECTED,
        },
      },
    );
  }
}
