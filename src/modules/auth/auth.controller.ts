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
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCookieAuth, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { XMLParser } from 'fast-xml-parser';
import * as moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { Autowired } from '../../decorators/autowired';
import { Cookies } from '../../decorators/cookies';
import { Public } from '../../decorators/is-public';
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
export class AuthController {
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

  constructor(private readonly authService: AuthService, private readonly baseLoginProvider: BaseLoginProvider) {}

  @Get('/version')
  @ApiOperation({
    summary: `Gets the current API version`,
    description: `Gets the current API version`,
  })
  @ApiResponse({
    status: 200,
    description: `Current API version`,
    content: {
      string: {
        examples: {
          version: {
            value: '1.1.0',
          },
        },
      },
    },
  })
  version(): string {
    return '1.1.0';
  }

  @Get('/db')
  @ApiOperation({
    summary: `Gets the current database version`,
    description: `Gets the current database version`,
  })
  @ApiResponse({
    status: 200,
    description: `Current database version`,
    content: {
      string: {
        examples: {
          version: {
            value: '4.4.0',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: `An error occurred getting mongodb version`,
  })
  public async getMongoDbVersion(): Promise<string> {
    try {
      const result = await db.admin().serverInfo();
      return result?.version ? result.version : 'Unknown';
    } catch (e) {
      Logger.error(`An error occurred getting mongodb version`, e, AuthController.name);
      throw new InternalServerErrorException(`An error occurred getting mongodb version`);
    }
  }

  @Post('/login')
  @ApiOperation({
    summary: `Logs an user into Kyso`,
    description: `Allows existing users to log-in into Kyso`,
  })
  @ApiBody({
    description: 'Login credentials and provider',
    required: true,
    examples: {
      json: {
        value: new Login('pass', LoginProviderEnum.KYSO, 'lo+rey@kyso.io', null),
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: `JWT token related to user`,
    content: {
      json: {
        examples: {
          jwtToken: {
            value: new NormalizedResponseDTO(
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
            ),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: `User is not allowed to log-in`,
    content: {
      json: {
        examples: {
          userNotExists: {
            value: new UnauthorizedException('Kyso authentication is disabled globally for that instance'),
          },
          invalidCredentials: {
            value: new UnauthorizedException('Invalid credentials'),
          },
          accessTokenRevoked: {
            value: new UnauthorizedException('Access token has been revoked'),
          },
          accessTokenExpired: {
            value: new UnauthorizedException('Access token has expired'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: `User is not allowed to log-in`,
    content: {
      json: {
        examples: {
          kysoError: {
            value: new ForbiddenException('Kyso authentication is disabled globally for that instance'),
          },
          githubError: {
            value: new ForbiddenException('GitHub authentication is disabled globally for that instance'),
          },
          gitlabError: {
            value: new ForbiddenException('GitLab authentication is disabled globally for that instance'),
          },
          googleError: {
            value: new ForbiddenException('Google authentication is disabled globally for that instance'),
          },
          bitbucketError: {
            value: new ForbiddenException('Bitbucket authentication is disabled globally for that instance'),
          },
        },
      },
    },
  })
  async login(@Body() login: Login, @Res() response: Response): Promise<void> {
    const jwt: string = await this.authService.login(login);
    const tokenExpirationTimeInHours = await this.kysoSettingsService.getValue(KysoSettingsEnum.DURATION_HOURS_JWT_TOKEN);
    const baseUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.BASE_URL);
    const urlObject = new URL(baseUrl);
    const domain = `.${urlObject.hostname}`;
    response.cookie('kyso-jwt-token', jwt, {
      secure: process.env.NODE_ENV !== 'development',
      httpOnly: true,
      sameSite: 'strict',
      expires: moment().add(tokenExpirationTimeInHours, 'hours').toDate(),
      domain: domain,
    });
    response.send(new NormalizedResponseDTO(jwt));
  }

  @Post('/logout')
  @ApiOperation({
    summary: `Log out the user from Kyso`,
    description: `Log out the user from Kyso`,
  })
  @ApiResponse({
    status: 200,
    description: `Invalidated JWT token in cookie`,
  })
  async logout(@Res() response: Response): Promise<void> {
    const baseUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.BASE_URL);
    const urlObject = new URL(baseUrl);
    const domain = `.${urlObject.hostname}`;
    response.cookie('kyso-jwt-token', '', {
      secure: process.env.NODE_ENV !== 'development',
      httpOnly: true,
      sameSite: 'strict',
      expires: new Date(0),
      domain: domain,
    });
    response.status(HttpStatus.OK).send();
  }

  @Post('/login/sso/ping-saml/callback')
  @ApiOperation({
    summary: `Callback URL for pingID`,
    description: `Callback URL. Expects an object with the properties: mail, givenName (name) and sn (surname)`,
  })
  @ApiBody({
    description: 'SAMLResponse',
    required: true,
    examples: {
      string: {
        value: 'SAMLResponse',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: `JWT token related to user`,
    content: {
      json: {
        examples: {
          jwtToken: {
            value: new NormalizedResponseDTO(
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
            ),
          },
        },
      },
    },
  })
  async loginSSOCallback(@Req() request, @Res() response: Response) {
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
      throw new BadRequestException(`Incomplete SAML payload received. Kyso requires the following properties: samlSubject, email, portrait and name`);
    }
  }

  @Post('/login/sso/okta-saml/callback')
  @ApiOperation({
    summary: `Callback URL for okta`,
    description: `Callback URL. Expects an object with the properties: mail, givenName (name) and sn (surname)`,
  })
  @ApiBody({
    description: 'SAMLResponse',
    required: true,
    examples: {
      json: {
        value: {
          SAMLResponse: 'SAMLResponse',
          RelayState: 'RelayState',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: `JWT token related to user`,
    content: {
      json: {
        examples: {
          jwtToken: {
            value: new NormalizedResponseDTO(
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJtYWlsQGVtYWlsLmNvbSIsIm5hbWUiOiJtYWlsIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
            ),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: `Incomplete SAML payload received`,
    content: {
      json: {
        examples: {
          error: {
            value: new BadRequestException(`Incomplete SAML payload received. Kyso requires the ['saml2p:Response'] property`),
          },
        },
      },
    },
  })
  async loginOktaCallback(@Body() body: { SAMLResponse: string; RelayState: string }, @Res() response: Response) {
    try {
      // Decode body.SAMLResponse in base64
      const xmlResponse = Buffer.from(body.SAMLResponse, 'base64').toString('utf8');
      const parser = new XMLParser({
        ignoreAttributes: false,
      });
      const data = parser.parse(xmlResponse);

      if (!data.hasOwnProperty('saml2p:Response')) {
        throw new BadRequestException(`Incomplete SAML payload received. Kyso requires the ['saml2p:Response'] property`);
      }
      if (!data['saml2p:Response'].hasOwnProperty('saml2:Assertion')) {
        throw new BadRequestException(`Incomplete SAML payload received. Kyso requires the ['saml2p:Response']['saml2:Assertion'] property`);
      }
      if (!data['saml2p:Response']['saml2:Assertion'].hasOwnProperty('saml2:Subject')) {
        throw new BadRequestException(`Incomplete SAML payload received. Kyso requires the ['saml2p:Response']['saml2:Assertion']['saml2:Subject'] property`);
      }
      if (!data['saml2p:Response']['saml2:Assertion']['saml2:Subject'].hasOwnProperty('saml2:NameID')) {
        throw new BadRequestException(`Incomplete SAML payload received. Kyso requires the ['saml2p:Response']['saml2:Assertion']['saml2:Subject']['saml2:NameID'] property`);
      }
      if (!data['saml2p:Response']['saml2:Assertion']['saml2:Subject']['saml2:NameID'].hasOwnProperty('#text')) {
        throw new BadRequestException(`Incomplete SAML payload received. Kyso requires the ['saml2p:Response']['saml2:Assertion']['saml2:Subject']['saml2:NameID']['#text'] property`);
      }
      const email: string = data['saml2p:Response']['saml2:Assertion']['saml2:Subject']['saml2:NameID']['#text'];

      console.log(data['saml2p:Response']['saml2:Assertion'].toString());

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
        throw new BadRequestException(`Incomplete SAML payload received. Kyso requires the saml2:NameID property`);
      }
    } catch (e) {
      throw new BadRequestException(`Incomplete SAML payload received. Kyso requires the saml2:NameID property`);
    }
  }

  @Post('/login/sso/fail')
  @Get('/login/sso/fail')
  @ApiResponse({
    status: 200,
    description: `Failed to login`,
    content: {
      string: {
        examples: {
          error: {
            value: 'Failed',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: `Failed to login`,
    content: {
      string: {
        examples: {
          error: {
            value: 'Failed',
          },
        },
      },
    },
  })
  async loginSSOFail() {
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
    examples: {
      json: {
        value: new SignUpDto('rey@kyso.io', 'rey', 'Rey Skywalker', '12345678'),
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: `Registered user`,
    content: {
      json: {
        examples: {
          signUp: {
            value: new NormalizedResponseDTO<User>(User.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: `Email in use`,
    content: {
      json: {
        examples: {
          error: {
            value: new ConflictException(`Email in use`),
          },
        },
      },
    },
  })
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
    examples: {
      json: {
        value: new VerifyEmailRequestDTO('rey@kyso.io', uuidv4()),
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: `JWT token related to user`,
    content: {
      json: {
        examples: {
          jwtToken: {
            value: new NormalizedResponseDTO(
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
            ),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: `Verification token has expired`,
    content: {
      json: {
        examples: {
          tokenExpired: {
            value: new ForbiddenException(`Verification token has expired`),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: `User not found`,
    content: {
      json: {
        examples: {
          userNotFound: {
            value: new NotFoundException(`User not found`),
          },
          tokenNotFound: {
            value: new NotFoundException(`Token not found`),
          },
        },
      },
    },
  })
  public async verifyEmail(@Body() verifyEmailRequestDto: VerifyEmailRequestDTO, @Res() response: Response): Promise<void> {
    const user: User = await this.usersService.getUser({ filter: { email: verifyEmailRequestDto.email } });
    if (!user) {
      throw new NotFoundException(`User not found`);
    }
    await this.usersService.verifyEmail(verifyEmailRequestDto);
    const jwt: string = await this.baseLoginProvider.createToken(user);
    const staticContentPrefix: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.STATIC_CONTENT_PREFIX);
    const tokenExpirationTimeInHours = await this.kysoSettingsService.getValue(KysoSettingsEnum.DURATION_HOURS_JWT_TOKEN);
    response.cookie('kyso-jwt-token', jwt, {
      secure: process.env.NODE_ENV !== 'development',
      httpOnly: true,
      path: staticContentPrefix,
      sameSite: 'strict',
      expires: moment().add(tokenExpirationTimeInHours, 'hours').toDate(),
    });
    response.send(new NormalizedResponseDTO(jwt));
  }

  @Post('/send-verification-email')
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Send an email to verify an user's email address`,
    description: `Allows new users to send an email to verify their email address`,
  })
  @ApiResponse({
    status: 200,
    description: `Sent email`,
    content: {
      json: {
        examples: {
          sentEmail: {
            value: new NormalizedResponseDTO(true),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: `No token provided`,
    content: {
      json: {
        examples: {
          noToken: {
            value: new UnauthorizedException(`No token provided`),
          },
        },
      },
    },
  })
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
    description: `JWT token related to user`,
    content: {
      json: {
        examples: {
          jwtToken: {
            value: new NormalizedResponseDTO(
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
            ),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: `User is not allowed to log-in`,
    content: {
      json: {
        examples: {
          invalidToken: {
            value: new ForbiddenException('Invalid token'),
          },
          userNotFound: {
            value: new ForbiddenException('User not found'),
          },
          unrecognizedTokenStatus: {
            value: new ForbiddenException('Unrecognized token status'),
          },
        },
      },
    },
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
          throw new ForbiddenException('Invalid signature');

        default:
          throw new ForbiddenException('Unrecognized token status');
      }
    } catch (ex) {
      throw new ForbiddenException();
    }
  }

  @Get('/username-available/:username')
  @ApiParam({
    name: 'username',
    required: true,
    description: `Username to check`,
    schema: { type: 'string' },
    example: 'janssen-randd',
  })
  @ApiResponse({
    status: 200,
    description: `Indicates if the username is available or not`,
    content: {
      json: {
        examples: {
          usernameAvailable: {
            value: new NormalizedResponseDTO(true),
          },
          usernameNotAvailable: {
            value: new NormalizedResponseDTO(false),
          },
        },
      },
    },
  })
  async checkUsernameAvailability(@Param('username') username: string): Promise<NormalizedResponseDTO<boolean>> {
    const result = await this.usersService.checkUsernameAvailability(username);
    return new NormalizedResponseDTO(result);
  }

  @Get('/user/:username/permissions')
  @ApiBearerAuth()
  @ApiParam({
    name: 'username',
    required: true,
    description: `Username of the user to retrieve their permissions`,
    schema: { type: 'string' },
    example: 'rey@kyso.io',
  })
  @ApiResponse({
    status: 200,
    description: `JWT token related to user`,
    content: {
      json: {
        examples: {
          userPermissions: {
            value: TokenPermissions.createEmpty(),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: `User is not allowed to log-in`,
    content: {
      json: {
        examples: {
          unhautenticatedRequest: {
            value: new UnauthorizedException('Unhautenticated request'),
          },
          noRights: {
            value: new UnauthorizedException('The requester user has no rights to access other user permissions'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: `User is not allowed to log-in`,
    content: {
      json: {
        examples: {
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
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
  @ApiOperation({
    summary: 'Get public permissions',
    description: 'Get public permissions',
  })
  @ApiResponse({
    status: 200,
    description: `JWT token related to user`,
    content: {
      json: {
        examples: {
          userPermissions: {
            value: TokenPermissions.createEmpty(),
          },
        },
      },
    },
  })
  async getPublicPermissions(): Promise<NormalizedResponseDTO<TokenPermissions>> {
    const tokenPermissions: TokenPermissions = await this.authService.getPermissions();
    return new NormalizedResponseDTO(tokenPermissions);
  }

  @Get('/check-permissions')
  @ApiCookieAuth('kyso-jwt-token')
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
  @ApiResponse({
    status: 200,
    description: 'Permissions checked',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
  })
  async checkPermissions(@Headers('x-original-uri') originalUri, @Res() response: Response, @Cookies() cookies: any, @Query('token') queryToken?: string) {
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

    const organization: Organization = await this.organizationsService.getOrganization({ filter: { sluglified_name: organizationName } });
    if (!organization) {
      Logger.error(`Organization ${organizationName} not found`);
      throw new NotFoundException('Organization not found');
    }

    const team: Team = await this.teamsService.getUniqueTeam(organization.id, teamName);
    if (!team) {
      throw new NotFoundException('Team not found');
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
  @ApiBearerAuth()
  @ApiBody({
    description: 'Permission to check',
    required: true,
    examples: {
      json: {
        value: new CheckPermissionDto('lightside', 'protected-team', ReportPermissionsEnum.READ),
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Permissions checked',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
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
  @ApiCookieAuth('kyso-jwt-token')
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
  @ApiResponse({
    status: 200,
    description: `Requested report`,
    content: {
      json: {
        examples: {
          jwtToken: {
            value: new NormalizedResponseDTO(ReportDTO.createEmpty()),
          },
        },
      },
      empty: {
        examples: {
          noData: {
            value: null,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: `User is not allowed to log-in`,
    content: {
      json: {
        examples: {
          noCookies: {
            value: new ForbiddenException('No cookies set'),
          },
          noTokenInCookies: {
            value: new ForbiddenException('No token in cookies'),
          },
          noPermissions: {
            value: new ForbiddenException('No permissions to access this report'),
          },
          reportIsNotApplication: {
            value: new ForbiddenException('The report is not application'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: `User is not allowed to log-in`,
    content: {
      json: {
        examples: {
          reportNotFound: {
            value: new NotFoundException('Report not found'),
          },
          teamNotFound: {
            value: new NotFoundException('Team not found'),
          },
          organizationNotFound: {
            value: new NotFoundException('Organization not found'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: `User is not allowed to log-in`,
    content: {
      json: {
        examples: {
          reportIsNotAnApplication: {
            value: new ForbiddenException('The report is not application'),
          },
        },
      },
    },
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
    const report: Report = await this.reportsService.getReportById(reportId);
    if (!report) {
      throw new NotFoundException(`Report '${reportId}' not found`);
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    if (!organization) {
      throw new NotFoundException('Organization not found');
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
        throw new ForbiddenException('No cookies set');
      }
      const token: Token = this.authService.evaluateAndDecodeToken(cookies['kyso-jwt-token']);
      if (!token) {
        throw new ForbiddenException('No token in cookies');
      }
      Logger.log(`Checking permissions for user ${token.username}`);
      token.permissions = await AuthService.buildFinalPermissionsForUser(token.email, this.usersService, this.teamsService, this.organizationsService, this.platformRoleService, this.userRoleService);
      userHasPermission = AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], team, organization);
      userId = token.id;
    }
    if (userHasPermission) {
      const report_type: string = report.report_type || '';
      // If the report is not an application return a 409 code when we have
      // been asked to send data, if not return a 403, if not the ingress
      // controller shows a 500 error.
      if (report_type != 'app' && !report_type.startsWith('app.')) {
        if (sendData) {
          throw new ConflictException('The report is not application');
        } else {
          throw new ForbiddenException('The report is not application');
        }
      }
      if (sendData) {
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, userId);
        return new NormalizedResponseDTO(reportDto);
      } else {
        return;
      }
    } else {
      throw new ForbiddenException('The user can see this report');
    }
  }
}
