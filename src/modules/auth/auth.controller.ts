import {
  CheckPermissionDto,
  KysoPermissions,
  KysoSettingsEnum,
  Login,
  LoginProviderEnum,
  NormalizedResponseDTO,
  Organization,
  Report,
  ReportDTO,
  ReportPermissionsEnum,
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
  ConflictException,
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
import { XMLParser } from 'fast-xml-parser';
import * as moment from 'moment';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Autowired } from '../../decorators/autowired';
import { Cookies } from '../../decorators/cookies';
import { Public } from '../../decorators/is-public';
import { GenericController } from '../../generic/controller.generic';
import { db } from '../../main';
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ReportsService } from '../reports/reports.service';
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

  @Autowired({ typeName: 'ReportsService' })
  private readonly reportsService: ReportsService;

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
    const tokenExpirationTimeInHours = await this.kysoSettingsService.getValue(KysoSettingsEnum.DURATION_HOURS_JWT_TOKEN);
    const baseUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.BASE_URL);
    const urlObject = new URL(baseUrl);
    const domain = `.${urlObject.hostname}`;
    res.cookie('kyso-jwt-token', jwt, {
      secure: process.env.NODE_ENV !== 'development',
      httpOnly: true,
      sameSite: 'strict',
      expires: moment().add(tokenExpirationTimeInHours, 'hours').toDate(),
      domain: domain,
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
    const baseUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.BASE_URL);
    const urlObject = new URL(baseUrl);
    const domain = `.${urlObject.hostname}`;
    res.cookie('kyso-jwt-token', '', {
      secure: process.env.NODE_ENV !== 'development',
      httpOnly: true,
      sameSite: 'strict',
      expires: new Date(0),
      domain: domain,
    });
    res.status(HttpStatus.OK).send();
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

    if (data && data.mail && data.givenName && data.sn) {
      // Build JWT token and redirect to frontend
      Logger.log('Build JWT token and redirect to frontend');

      const login: Login = new Login(
        AuthService.generateRandomPassword(), // set a random secure password
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
      response.redirect(`${frontendUrl}/sso/${jwt}`);
    } else {
      throw new PreconditionFailedException(`Incomplete SAML payload received. Kyso requires the following properties: samlSubject, email, portrait and name`);
    }
  }

  @Post('/login/sso/okta-saml/callback')
  @ApiOperation({
    summary: `Callback URL for okta`,
    description: `Callback URL. Expects an object with the properties: mail, givenName (name) and sn (surname)`,
  })
  async loginOktaCallback(@Body() body: { SAMLResponse: string; RelayState: string }, @Res() response) {
    try {
      // Decode body.SAMLResponse in base64
      const xmlResponse = Buffer.from(body.SAMLResponse, 'base64').toString('utf8');
      const parser = new XMLParser({
        ignoreAttributes: false,
      });
      const data = parser.parse(xmlResponse);
      if (!data.hasOwnProperty('saml2p:Response')) {
        throw new PreconditionFailedException(`Incomplete SAML payload received. Kyso requires the ['saml2p:Response'] property`);
      }
      if (!data['saml2p:Response'].hasOwnProperty('saml2:Assertion')) {
        throw new PreconditionFailedException(`Incomplete SAML payload received. Kyso requires the ['saml2p:Response']['saml2:Assertion'] property`);
      }
      if (!data['saml2p:Response']['saml2:Assertion'].hasOwnProperty('saml2:Subject')) {
        throw new PreconditionFailedException(`Incomplete SAML payload received. Kyso requires the ['saml2p:Response']['saml2:Assertion']['saml2:Subject'] property`);
      }
      if (!data['saml2p:Response']['saml2:Assertion']['saml2:Subject'].hasOwnProperty('saml2:NameID')) {
        throw new PreconditionFailedException(`Incomplete SAML payload received. Kyso requires the ['saml2p:Response']['saml2:Assertion']['saml2:Subject']['saml2:NameID'] property`);
      }
      if (!data['saml2p:Response']['saml2:Assertion']['saml2:Subject']['saml2:NameID'].hasOwnProperty('#text')) {
        throw new PreconditionFailedException(`Incomplete SAML payload received. Kyso requires the ['saml2p:Response']['saml2:Assertion']['saml2:Subject']['saml2:NameID']['#text'] property`);
      }
      const email: string = data['saml2p:Response']['saml2:Assertion']['saml2:Subject']['saml2:NameID']['#text'];

      if (email) {
        // Build JWT token and redirect to frontend
        Logger.log('Build JWT token and redirect to frontend');
        const login: Login = new Login(
          AuthService.generateRandomPassword(), // set a random secure password
          LoginProviderEnum.OKTA_SAML,
          email,
          data,
        );
        Logger.log(`Loging into Kyso with email ${email}`);
        const jwt = await this.authService.login(login);
        Logger.log(`JWT token generated ${jwt} for email ${email}`);
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
        response.redirect(`${frontendUrl}/sso/${jwt}`);
      } else {
        throw new PreconditionFailedException(`Incomplete SAML payload received. Kyso requires the saml2:NameID property`);
      }
    } catch (e) {
      console.log(e);
      throw new PreconditionFailedException(`Incomplete SAML payload received. Kyso requires the saml2:NameID property`);
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
  @Public()
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
  @ApiResponse({
    status: 403,
    description: `Verification token has expired`,
    type: String,
  })
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

  /* DEPRECATED
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
  */

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
  async getUserPermissions(@CurrentToken() token: Token, @Param('username') username: string) {
    if (!token) {
      throw new UnauthorizedException('Unhautenticated request');
    }
    if (!token.isGlobalAdmin() && token.username.toLowerCase() !== username.toLowerCase()) {
      throw new UnauthorizedException(`The requester user has no rights to access other user permissions`);
    }
    const tokenPermissions: TokenPermissions = await this.authService.getPermissions(username ?? token.username);
    return new NormalizedResponseDTO(tokenPermissions);
  }

  @Get('/public-permissions')
  @Public()
  async getPublicPermissions(): Promise<NormalizedResponseDTO<TokenPermissions>> {
    const tokenPermissions: TokenPermissions = await this.authService.getPermissions();
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

    token.permissions = await AuthService.buildFinalPermissionsForUser(token.email, this.usersService, this.teamsService, this.organizationsService, this.platformRoleService, this.userRoleService);

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

  @Get('/check-app-permissions')
  @Post('/check-app-permissions')
  @ApiHeader({
    name: 'X-Original-URL',
    description: 'Original app URL (sent by the ingress controller)',
    required: true,
  })
  @ApiQuery({
    name: 'data',
    type: Boolean,
    description: 'Send Report Data on Response. Optional, defaults to false',
    required: false,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `App Report Data`,
    type: Report,
  })
  async checkAppPermissions(@Headers('X-Original-URL') originalUrl, @Cookies() cookies: any, @Query('data') sendData = false): Promise<NormalizedResponseDTO<ReportDTO>> {
    Logger.log(`Checking permissions for ${originalUrl}`);
    if (!originalUrl || originalUrl.length === 0) {
      throw new ForbiddenException('You do not have permissions to access this report');
    }
    // Get the reportId from the originalUrl removing the appDomainSuffix from it
    const baseUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.BASE_URL);
    const urlObject = new URL(baseUrl);
    // FIXME: hardcoded 'app' subdomain, should we add a setting for that?
    const appDomainSuffix = `app.${urlObject.hostname}`;
    const originalUrlObject = new URL(originalUrl);
    const originalUrlHostname = originalUrlObject.hostname;
    const reportId = originalUrlHostname.replace(`.${appDomainSuffix}`, '');
    // Find report and get organization and team from it
    let report: Report = null;
    try {
      report = await this.reportsService.getReportById(reportId);
      if (!report) {
        throw new ForbiddenException(`Report '${reportId}' not found`);
      }
    } catch (error) {
      throw new ForbiddenException(`Error looking for report '${reportId}': ${error}`);
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!team) {
      throw new PreconditionFailedException('Team not found');
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    if (!organization) {
      throw new PreconditionFailedException('Organization not found');
    }
    Logger.log(`Report '${report.title}' is in team '${team.sluglified_name}' and org '${organization.sluglified_name}'`);
    let userHasPermission: boolean;
    let userId: string | null;
    if (team.visibility === TeamVisibilityEnum.PUBLIC) {
      userHasPermission = true;
      userId = null;
    } else {
      // Read token from cookie
      if (!cookies || !cookies['kyso-jwt-token'] || cookies['kyso-jwt-token'].length === 0) {
        throw new ForbiddenException('No cookies set. Forbidden');
      }
      const token: Token = this.authService.evaluateAndDecodeToken(cookies['kyso-jwt-token']);
      if (!token) {
        throw new ForbiddenException('No token in cookies. Forbidden');
      }
      Logger.log(`Checking permissions for user ${token.username}`);
      token.permissions = await AuthService.buildFinalPermissionsForUser(token.email, this.usersService, this.teamsService, this.organizationsService, this.platformRoleService, this.userRoleService);
      userHasPermission = AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], team, organization);
      userId = token.id;
    }
    if (userHasPermission) {
      // FIXME: For now convert the report_type to a string, we should use the Enum
      const report_type: string = report.report_type || '';
      // If the report is not an application return a 409 code when we have
      // been asked to send data, if not return a 403, if not the ingress
      // controller shows a 500 error.
      if (report_type != 'app' && !report_type.startsWith('app.')) {
        if (sendData) {
          throw new ConflictException('The report is not application. Forbidden');
        } else {
          throw new ForbiddenException('The report is not application. Forbidden');
        }
      } else if (sendData) {
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, userId);
        return new NormalizedResponseDTO(reportDto);
      } else {
        return;
      }
    } else {
      throw new ForbiddenException('The user can see this report. Forbidden');
    }
  }
}
