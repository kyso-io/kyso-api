import { AddUserOrganizationDto, KysoRole, Organization, OrganizationMember, RequestAccess, RequestAccessStatusEnum, Team, User } from '@kyso-io/kyso-model';
import { BadRequestException, ForbiddenException, Injectable, Logger, Provider } from '@nestjs/common';
import { isArray } from 'class-validator';
import { Autowired } from 'src/decorators/autowired';
import { PlatformRole } from 'src/security/platform-roles';
import { AutowiredService } from '../../generic/autowired.generic';
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

  constructor(private readonly provider: RequestAccessMongoProvider) {
    super();
  }

  public async requestAccessToOrganization(requester_user_id: string, organization_id: string): Promise<RequestAccess> {
    Logger.log(`User ${requester_user_id} requesting access to organization ${organization_id}`);

    const requesterUser: User = await this.usersService.getUserById(requester_user_id);
    if (!requesterUser) {
      throw new BadRequestException(`Invalid user provided`);
    }

    const organization: Organization = await this.organizationsService.getOrganizationById(organization_id);
    if (!organization) {
      throw new BadRequestException(`Invalid organization provided`);
    }

    const requestAccess: RequestAccess = new RequestAccess(requester_user_id, organization_id, null, RequestAccessStatusEnum.PENDING, null, null);

    return this.provider.create(requestAccess);
  }

  public async requestAccessToTeam(requester_user_id: string, team_id: string): Promise<RequestAccess> {
    Logger.log(`User ${requester_user_id} requesting access to team ${team_id}`);

    const requesterUser: User = await this.usersService.getUserById(requester_user_id);
    if (!requesterUser) {
      throw new BadRequestException(`Invalid user provided`);
    }

    const team: Team = await this.teamsService.getTeamById(team_id);
    if (!team) {
      throw new BadRequestException(`Invalid team provided`);
    }

    const requestAccess: RequestAccess = new RequestAccess(requester_user_id, null, team_id, RequestAccessStatusEnum.PENDING, null, null);

    return this.provider.create(requestAccess);
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

    // Add requester to organization as reader (fixed)
    const addUserToOrg: AddUserOrganizationDto = new AddUserOrganizationDto(request[0].organization_id, request[0].requester_user_id, PlatformRole.TEAM_READER_ROLE.name);

    await this.organizationsService.addMemberToOrganization(addUserToOrg);

    // add requester to team as specified role

    // Update the request
    let finalStatus = RequestAccessStatusEnum.PENDING;
    let kysoRole = PlatformRole.TEAM_READER_ROLE;

    if (role !== PlatformRole.TEAM_READER_ROLE.name) {
      finalStatus = RequestAccessStatusEnum.ACCEPTED_AS_READER;
      kysoRole = PlatformRole.TEAM_READER_ROLE;
    }

    if (role !== PlatformRole.TEAM_CONTRIBUTOR_ROLE.name) {
      finalStatus = RequestAccessStatusEnum.ACCEPTED_AS_CONTRIBUTOR;
      kysoRole = PlatformRole.TEAM_CONTRIBUTOR_ROLE;
    }

    await this.teamsService.addMemberToTeam(request[0].channel_id, request[0].requester_user_id, [kysoRole]);

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

    if (!rejecterUser) {
      throw new BadRequestException(`Invalid user provided`);
    }

    if (!request || !isArray(request) || request.length === 0) {
      throw new BadRequestException(`Invalid request provided`);
    }

    if (request[0].organization_id !== organizationId) {
      throw new ForbiddenException(`Organization identifiers mismatch`);
    }

    return this.rejectRequest(request[0], secret, rejecterUser);
  }

  public async rejectTeamRequest(teamId: string, requestId: string, secret: string, rejecter_id: string): Promise<RequestAccess> {
    const request: RequestAccess[] = await this.provider.read({ filter: { id: requestId } });
    const rejecterUser: User = await this.usersService.getUserById(rejecter_id);

    if (!rejecterUser) {
      throw new BadRequestException(`Invalid user provided`);
    }

    if (!request || !isArray(request) || request.length === 0) {
      throw new BadRequestException(`Invalid request provided`);
    }

    if (request[0].channel_id !== teamId) {
      throw new ForbiddenException(`Channel identifiers mismatch`);
    }

    return this.rejectRequest(request[0], secret, rejecterUser);
  }

  private async rejectRequest(request: RequestAccess, secret: string, rejecterUser: User): Promise<RequestAccess> {
    if (request[0].secret !== secret) {
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
