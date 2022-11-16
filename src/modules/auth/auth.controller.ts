import {
  AuthProviderSpec,
  CheckPermissionDto,
  KysoPermissions,
  KysoSettingsEnum,
  Login,
  LoginProviderEnum,
  NormalizedResponseDTO,
  Organization,
  OrganizationAuthOptions,
  PingIdSAMLSpec,
  ReportPermissionsEnum,
  ResourcePermissions,
  SignUpDto,
  Team,
  TeamVisibilityEnum,
  Token,
  TokenPermissions,
  TokenStatusEnum,
  User,
  VerifyEmailRequestDTO,
} from '@kyso-io/kyso-model';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  PreconditionFailedException,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as moment from 'moment';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Autowired } from '../../decorators/autowired';
import { Cookies } from '../../decorators/cookies';
import { Public } from '../../decorators/is-public';
import { GenericController } from '../../generic/controller.generic';
import { db } from '../../main';
import { PlatformRole } from '../../security/platform-roles';
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
import { CurrentToken } from './annotations/current-token.decorator';
import { AuthService } from './auth.service';
import { PlatformRoleService } from './platform-role.service';
import { BaseLoginProvider } from './providers/base-login.provider';
import { UserRoleService } from './user-role.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const querystring = require('querystring');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Saml2js = require('saml2js');

@ApiTags('auth')
@Controller('auth')
export class AuthController extends GenericController<string> {
  @Autowired({ typeName: 'UsersService' })
  private readonly usersService: UsersService;

  @Autowired({ typeName: 'OrganizationsService' })
  private readonly organizationsService: OrganizationsService;

  @Autowired({ typeName: 'UserRoleService' })
  public readonly userRoleService: UserRoleService;

  @Autowired({ typeName: 'PlatformRoleService' })
  public readonly platformRoleService: PlatformRoleService;

  @Autowired({ typeName: 'TeamsService' })
  public readonly teamsService: TeamsService;

  @Autowired({ typeName: 'KysoSettingsService' })
  public readonly kysoSettingsService: KysoSettingsService;

  constructor(private readonly authService: AuthService, private readonly baseLoginProvider: BaseLoginProvider) {
    super();
  }

  @Get('/version')
  version(): string {
    return '1.1.0';
  }

  @Get('/db')
  public async getMongoDbVersion(): Promise<string> {
    return new Promise<string | null>((resolve) => {
      db.admin().serverInfo((err, info) => {
        if (err) {
          Logger.error(`An error occurred getting mongodb version`, err, AuthController.name);
          resolve(err);
        } else {
          resolve(info?.version ? info.version : 'Unknown');
        }
      });
    });
  }

  @Post('/login')
  @ApiOperation({
    summary: `Logs an user into Kyso`,
    description: `Allows existing users to log-in into Kyso`,
  })
  @ApiResponse({
    status: 200,
    description: `JWT token related to user`,
    type: String,
  })
  @ApiBody({
    description: 'Login credentials and provider',
    required: true,
    type: Login,
    examples: Login.examples(),
  })
  async login(@Body() login: Login, @Res() res): Promise<void> {
    const jwt: string = await this.authService.login(login);
    const staticContentPrefix: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.STATIC_CONTENT_PREFIX);
    const tokenExpirationTimeInHours = await this.kysoSettingsService.getValue(KysoSettingsEnum.DURATION_HOURS_JWT_TOKEN);
    res.cookie('kyso-jwt-token', jwt, {
      secure: process.env.NODE_ENV !== 'development',
      httpOnly: true,
      path: staticContentPrefix,
      sameSite: 'strict',
      expires: moment().add(tokenExpirationTimeInHours, 'hours').toDate(),
    });
    res.send(new NormalizedResponseDTO(jwt));
  }

  @Post('/logout')
  @ApiOperation({
    summary: `Log out the user from Kyso`,
    description: `Log out the user from Kyso`,
  })
  @ApiResponse({
    status: 200,
    description: `JWT token related to user`,
    type: String,
  })
  async logout(@Res() res): Promise<void> {
    const staticContentPrefix: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.STATIC_CONTENT_PREFIX);
    res.cookie('kyso-jwt-token', '', {
      secure: process.env.NODE_ENV !== 'development',
      httpOnly: true,
      path: staticContentPrefix,
      sameSite: 'strict',
      expires: new Date(0),
    });
    res.status(HttpStatus.OK).send();
  }

  @Get('/login/sso/ping-saml/:organizationSlug')
  @ApiOperation({
    summary: `Logs an user into Kyso with PingID`,
    description: `Logs an user into Kyso with PingID`,
  })
  @ApiResponse({
    status: 302,
    description: `Redirect to the configured SSO instance of PingID`,
    type: String,
  })
  @ApiParam({
    name: 'organizationSlug',
    required: true,
    description: `Slugified name of kyso's organization to login`,
    schema: { type: 'string' },
    example: 'JANSSEN-RANDD',
  })
  async loginSSO(@Param('organizationSlug') organizationSlug: string) {
    try {
      // Fetch organizationSlug configuration
      const organization: Organization = await this.organizationsService.getOrganization({
        filter: {
          name: organizationSlug,
        },
      });

      let pingSamlConfiguration: AuthProviderSpec;

      if (organization.options && organization.options.auth && organization.options.auth.otherProviders && organization.options.auth.otherProviders.length > 0) {
        pingSamlConfiguration = organization.options.auth.otherProviders.find((x) => x.type === LoginProviderEnum.PING_ID_SAML);
      } else {
        return 'Your organization has not configured PingSAML as auth provider';
      }

      // Set variables to organizationConfiguration
      let authPingIdSamlSsoUrl;
      let authPingIdSamlEnvironmentCode;
      let authPingIdSPEntityId;

      if (pingSamlConfiguration) {
        const options = pingSamlConfiguration.options as PingIdSAMLSpec;

        authPingIdSamlSsoUrl = options.sso_url;
        authPingIdSamlEnvironmentCode = options.environment_code;
        authPingIdSPEntityId = options.sp_entity_id;
      } else {
        return 'Your organization has not configured PingSAML as auth provider';
      }
    } catch (ex) {
      Logger.error('Error using ping saml auth sso', ex);
      return 'Your organization has not properly configured PingSAML as auth provider';
    }
  }

  @Post('/login/sso/ping-saml/callback')
  @ApiOperation({
    summary: `Callback URL for pingID`,
    description: `Callback URL. Expects an object with the properties: mail, givenName (name) and sn (surname)`,
  })
  async loginSSOCallback(@Req() request, @Res() response) {
    const xmlResponse = request.body.SAMLResponse;

    const parser = new Saml2js(xmlResponse);
    const data = parser.toObject();

    console.log(data);

    if (data && data.mail && data.givenName && data.sn) {
      // Build JWT token and redirect to frontend
      console.log('Build JWT token and redirect to frontend');
      const login: Login = new Login(
        uuidv4(), // set a random password
        LoginProviderEnum.PING_ID_SAML,
        data.mail,
        data,
      );

      const jwt = await this.authService.login(login);
      const frontendUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL);

      const staticContentPrefix: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.STATIC_CONTENT_PREFIX);
      const tokenExpirationTimeInHours = await this.kysoSettingsService.getValue(KysoSettingsEnum.DURATION_HOURS_JWT_TOKEN);
      response.cookie('kyso-jwt-token', jwt, {
        secure: process.env.NODE_ENV !== 'development',
        httpOnly: true,
        path: staticContentPrefix,
        sameSite: 'strict',
        expires: moment().add(tokenExpirationTimeInHours, 'hours').toDate(),
      });

      console.log(`Redirecting to ${frontendUrl}/sso/${jwt}`);
      response.redirect(`${frontendUrl}/sso/${jwt}`);
    } else {
      throw new PreconditionFailedException(`Incomplete SAML payload received. Kyso requires the following properties: samlSubject, email, portrait and name`);
    }
  }

  @Post('/login/sso/fail')
  @Get('/login/sso/fail')
  async loginSSOFail(@Req() request) {
    return 'Failed';
  }

  @Post('/sign-up')
  @ApiOperation({
    summary: `Signs up an user into Kyso`,
    description: `Allows new users to sign-up into Kyso`,
  })
  @ApiBody({
    description: 'User registration data',
    required: true,
    type: SignUpDto,
    examples: SignUpDto.examples(),
  })
  @ApiNormalizedResponse({ status: 201, description: `Registered user`, type: User })
  public async signUp(@Body() signUpDto: SignUpDto): Promise<NormalizedResponseDTO<User>> {
    const user: User = await this.usersService.createUser(signUpDto);
    return new NormalizedResponseDTO(user);
  }

  @Post('/verify-email')
  @ApiOperation({
    summary: `Verify an user's email address`,
    description: `Allows new users to verify their email address`,
  })
  @ApiBody({
    description: 'Email verification data',
    required: true,
    type: VerifyEmailRequestDTO,
    examples: VerifyEmailRequestDTO.examples(),
  })
  @ApiNormalizedResponse({ status: 200, description: `Jwt token`, type: String })
  public async verifyEmail(@Body() verifyEmailRequestDto: VerifyEmailRequestDTO, @Res() res): Promise<void> {
    const user: User = await this.usersService.getUser({ filter: { email: verifyEmailRequestDto.email } });
    if (!user) {
      throw new NotFoundException(`User not found`);
    }
    await this.usersService.verifyEmail(verifyEmailRequestDto);
    const jwt: string = await this.baseLoginProvider.createToken(user);
    const staticContentPrefix: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.STATIC_CONTENT_PREFIX);
    const tokenExpirationTimeInHours = await this.kysoSettingsService.getValue(KysoSettingsEnum.DURATION_HOURS_JWT_TOKEN);
    res.cookie('kyso-jwt-token', jwt, {
      secure: process.env.NODE_ENV !== 'development',
      httpOnly: true,
      path: staticContentPrefix,
      sameSite: 'strict',
      expires: moment().add(tokenExpirationTimeInHours, 'hours').toDate(),
    });
    res.send(new NormalizedResponseDTO(jwt));
  }

  @Post('/send-verification-email')
  @ApiOperation({
    summary: `Send an email to verify an user's email address`,
    description: `Allows new users to send an email to verify their email address`,
  })
  @ApiNormalizedResponse({ status: 200, description: `Sent email`, type: Boolean })
  public async sendVerifyEmail(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<boolean>> {
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    const user: User = await this.usersService.getUserById(token.id);
    const result: boolean = await this.usersService.sendVerificationEmail(user);
    return new NormalizedResponseDTO(result);
  }

  @Post('/refresh-token')
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Refresh token`,
    description: `Refresh token`,
  })
  @ApiResponse({
    status: 201,
    description: `Updated token related to user`,
    type: Token,
  })
  @ApiResponse({
    status: 403,
    description: `Token is invalid or expired`,
  })
  async refreshToken(@Headers('authorization') jwtToken: string): Promise<NormalizedResponseDTO<string>> {
    if ('Bearer ' !== jwtToken.substring(0, 7)) {
      throw new UnauthorizedException('Invalid token');
    }
    try {
      const splittedToken = jwtToken.split('Bearer ');

      const tokenStatus: TokenStatusEnum = this.authService.verifyToken(splittedToken[1]);

      switch (tokenStatus) {
        case TokenStatusEnum.VALID:
        case TokenStatusEnum.EXPIRED:
          // Expired, but issued by us
          const decodedToken: Token = this.authService.decodeToken(splittedToken[1]);
          if (decodedToken) {
            const jwt: string = await this.authService.refreshToken(decodedToken);
            if (!jwt) {
              throw new ForbiddenException();
            }
            return new NormalizedResponseDTO(jwt);
          } else {
            throw new ForbiddenException();
          }

        case TokenStatusEnum.INVALID_SIGNATURE:
          // Raise security alert
          console.error('SECURITY WARNING: INVALID SIGNATURE DETECTED');
          throw new ForbiddenException();

        default:
          throw new ForbiddenException();
      }
    } catch (ex) {
      throw new ForbiddenException();
    }
  }

  @Get('/organization/:organizationSlug/options')
  @ApiParam({
    name: 'organizationSlug',
    required: true,
    description: `Slugified name of kyso's organization to login`,
    schema: { type: 'string' },
    example: 'JANSSEN-RANDD',
  })
  @ApiNormalizedResponse({ status: 200, description: `Organization auth options`, type: OrganizationAuthOptions })
  async getOrganizationAuthOptions(@Param('organizationSlug') organizationSlug: string): Promise<NormalizedResponseDTO<OrganizationAuthOptions>> {
    // Fetch organizationSlug configuration
    const organization: Organization = await this.organizationsService.getOrganization({
      filter: {
        sluglified_name: organizationSlug,
      },
    });
    if (!organization) {
      throw new PreconditionFailedException(`Organization with slug ${organizationSlug} not found`);
    }
    return new NormalizedResponseDTO(organization.options?.auth ? organization.options.auth : null);
  }

  @Get('/username-available/:username')
  @ApiParam({
    name: 'username',
    required: true,
    description: `Username to check`,
    schema: { type: 'string' },
    example: 'janssen-randd',
  })
  @ApiNormalizedResponse({ status: 200, description: `Username is available`, type: Boolean })
  async checkUsernameAvailability(@Param('username') username: string): Promise<NormalizedResponseDTO<boolean>> {
    const result = await this.usersService.checkUsernameAvailability(username);
    return new NormalizedResponseDTO(result);
  }

  @Get('/user/:username/permissions')
  @ApiParam({
    name: 'username',
    required: true,
    description: `Username of the user to retrieve their permissions`,
    schema: { type: 'string' },
    example: 'rey@kyso.io',
  })
  @ApiBearerAuth()
  async getUserPermissions(@CurrentToken() requesterUser: Token, @Param('username') username: string) {
    if (!requesterUser) {
      throw new UnauthorizedException('Unhautenticated request');
    }

    if (!requesterUser.isGlobalAdmin() && requesterUser.username.toLowerCase() !== username.toLowerCase()) {
      throw new UnauthorizedException(`The requester user has no rights to access other user permissions`);
    }

    const finalPermissions: TokenPermissions = requesterUser.permissions;
    const { data: publicTokenPermissions } = await this.getPublicPermissions();
    // Global permissions
    for (const kysoPermission of publicTokenPermissions.global) {
      if (!finalPermissions.global.includes(kysoPermission)) {
        finalPermissions.global.push(kysoPermission);
      }
    }
    // Organization permissions
    for (const publicOrganizationResourcePermission of publicTokenPermissions.organizations) {
      const index: number = finalPermissions.organizations.findIndex(
        (organizationResourcePermission: ResourcePermissions) => organizationResourcePermission.id === publicOrganizationResourcePermission.id,
      );
      if (index === -1) {
        finalPermissions.organizations.push(publicOrganizationResourcePermission);
      }
    }
    // Team permissions
    for (const publicTeamResourcePermission of publicTokenPermissions.teams) {
      const index: number = finalPermissions.teams.findIndex((teamResourcePermission: ResourcePermissions) => teamResourcePermission.id === publicTeamResourcePermission.id);
      if (index === -1) {
        finalPermissions.teams.push(publicTeamResourcePermission);
      }
    }

    // If the user is global admin
    return new NormalizedResponseDTO(finalPermissions);
  }

  @Get('/public-permissions')
  @Public()
  async getPublicPermissions(): Promise<NormalizedResponseDTO<TokenPermissions>> {
    const globalKysoPermissions: KysoPermissions[] = [];
    const organizationsResourcePermissions: ResourcePermissions[] = [];
    const teamsResourcePermissions: ResourcePermissions[] = [];
    const publicTeams: Team[] = await this.teamsService.getTeams({
      filter: {
        visibility: TeamVisibilityEnum.PUBLIC,
      },
    });
    if (publicTeams.length > 0) {
      const uniqueOrganizationIds: string[] = [];
      publicTeams.forEach((team: Team) => {
        const resourcePermissions: ResourcePermissions = new ResourcePermissions(
          team.sluglified_name,
          team.display_name,
          PlatformRole.EXTERNAL_ROLE.permissions,
          team.id,
          false,
          team.organization_id,
          ['external'],
          team.visibility,
        );
        teamsResourcePermissions.push(resourcePermissions);
      });
      publicTeams.forEach((team) => {
        if (!uniqueOrganizationIds.includes(team.organization_id)) {
          uniqueOrganizationIds.push(team.organization_id);
        }
      });
      const publicOrganizations: Organization[] = await this.organizationsService.getOrganizations({
        filter: {
          _id: { $in: uniqueOrganizationIds.map((id) => new ObjectId(id)) },
        },
      });
      publicOrganizations.forEach((organization: Organization) => {
        const resourcePermissions: ResourcePermissions = new ResourcePermissions(organization.sluglified_name, organization.display_name, [], organization.id, false, organization.id, [], null);
        organizationsResourcePermissions.push(resourcePermissions);
      });
    }
    const tokenPermissions: TokenPermissions = new TokenPermissions(globalKysoPermissions, teamsResourcePermissions, organizationsResourcePermissions);
    return new NormalizedResponseDTO(tokenPermissions);
  }

  @Get('/check-permissions')
  @ApiHeader({
    name: 'x-original-uri',
    description: 'Original SCS url',
    required: true,
  })
  @ApiQuery({
    name: 'token',
    type: String,
    description: 'JWT Token to check. Optional',
    required: false,
  })
  async checkPermissions(@Headers('x-original-uri') originalUri, @Res() response: any, @Cookies() cookies: any, @Query('token') queryToken?: string) {
    Logger.log(`Checking permissions for ${originalUri}`);

    if (process.env.NODE_ENV === 'development') {
      response.status(HttpStatus.OK).send();
      return;
    }

    if (!originalUri || originalUri.length === 0) {
      response.status(HttpStatus.FORBIDDEN).send();
      return;
    }

    // URI has the following structure /scs/{organizationName}/{teamName}/reports/{reportId}/...
    // Remove the first /scs/
    const staticContentPrefix: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.STATIC_CONTENT_PREFIX);
    originalUri = originalUri.replace(`${staticContentPrefix}/`, '');

    // Split by "/"
    const splittedUri: string[] = originalUri.split('/');
    const organizationName = splittedUri[0];
    const teamName = splittedUri[1];
    // const reportName = splittedUri[3]

    const organization: Organization = await this.organizationsService.getOrganization({ filter: { sluglified_name: organizationName } });
    if (!organization) {
      Logger.error(`Organization ${organizationName} not found`);
      throw new PreconditionFailedException('Organization not found');
    }

    const team: Team = await this.teamsService.getUniqueTeam(organization.id, teamName);
    if (!team) {
      throw new PreconditionFailedException('Team not found');
    }
    if (team.visibility === TeamVisibilityEnum.PUBLIC) {
      response.status(HttpStatus.OK).send();
      return;
    }

    // Read token from cookie or querystring
    let token: Token;
    if (!cookies || !cookies['kyso-jwt-token'] || cookies['kyso-jwt-token'].length === 0) {
      Logger.log(`No cookies set. Looking for query string token`);

      if (queryToken) {
        Logger.log(`Received query token: ${queryToken}`);
        token = this.authService.evaluateAndDecodeToken(queryToken);
      } else {
        Logger.log(`Query Token not received. Trying to extract it from the original-uri`);
        // check if we have a query string
        const qi: number = originalUri.indexOf('?');
        // no token in cookies or querystring, forbidden
        if (qi == -1) {
          response.status(HttpStatus.FORBIDDEN).send();
          return;
        }
        // try to find the token on the query string
        const qs = querystring.parse(originalUri.substring(qi + 1));

        Logger.log(`Extracted token ${qs.token}`);
        token = this.authService.evaluateAndDecodeToken(qs.token);
      }
      Logger.log(`Received token: ${queryToken}`);
    } else {
      Logger.log(`There are cookies`);
      Logger.log(`Received token: ${cookies['kyso-jwt-token']}`);

      token = this.authService.evaluateAndDecodeToken(cookies['kyso-jwt-token']);
    }

    if (!token) {
      Logger.log("Didn't received any token. Forbidden");
      response.status(HttpStatus.FORBIDDEN).send();
      return;
    }

    token.permissions = await AuthService.buildFinalPermissionsForUser(token.username, this.usersService, this.teamsService, this.organizationsService, this.platformRoleService, this.userRoleService);

    const userHasPermission: boolean = AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], team, organization);

    if (userHasPermission) {
      response.status(HttpStatus.OK).send();
    } else {
      response.status(HttpStatus.FORBIDDEN).send();
    }
  }

  @Post('/check-permission')
  @ApiBody({
    description: 'Permission to check',
    required: true,
    type: CheckPermissionDto,
    examples: CheckPermissionDto.examples(),
  })
  async checkPermission(@CurrentToken() token: Token, @Body() checkPermissionDto: CheckPermissionDto): Promise<NormalizedResponseDTO<boolean>> {
    if (!token) {
      throw new UnauthorizedException('No bearer token provided');
    }

    const objects: { organization: Organization; team: Team } = await this.authService.retrieveOrgAndTeamFromSlug(checkPermissionDto.organization, checkPermissionDto.team);

    const userHasPermission: boolean = AuthService.hasPermissions(token, [checkPermissionDto.permission as KysoPermissions], objects.team, objects.organization);
    return new NormalizedResponseDTO(userHasPermission);
  }
}
