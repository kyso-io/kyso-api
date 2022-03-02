import {
    AuthProviderSpec,
    CreateUserRequestDTO,
    Login,
    LoginProviderEnum,
    NormalizedResponseDTO,
    Organization,
    PingIdSAMLSpec,
    Token,
    User,
} from '@kyso-io/kyso-model'
import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    Headers,
    Logger,
    Param,
    Post,
    PreconditionFailedException,
    Req,
    Res,
    UnauthorizedException,
} from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { GenericController } from '../../generic/controller.generic'
import { db } from '../../main'
import { KysoSettingsEnum } from '../kyso-settings/enums/kyso-settings.enum'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { CurrentToken } from './annotations/current-token.decorator'
import { AuthService } from './auth.service'
import { PlatformRoleService } from './platform-role.service'
import { UserRoleService } from './user-role.service'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Saml2js = require('saml2js')

@ApiTags('auth')
@Controller('auth')
export class AuthController extends GenericController<string> {
    @Autowired({ typeName: 'UsersService' })
    private readonly usersService: UsersService

    @Autowired({ typeName: 'OrganizationsService' })
    private readonly organizationsService: OrganizationsService

    @Autowired({ typeName: 'UserRoleService' })
    public userRoleService: UserRoleService

    @Autowired({ typeName: 'PlatformRoleService' })
    public platformRoleService: PlatformRoleService

    @Autowired({ typeName: 'TeamsService' })
    public teamsService: TeamsService

    @Autowired({ typeName: 'KysoSettingsService' })
    public kysoSettingsService: KysoSettingsService

    constructor(private readonly authService: AuthService) {
        super()
    }

    @Get('/version')
    version(): string {
        return '0.0.2'
    }

    @Get('/db')
    public async getMongoDbVersion(): Promise<string> {
        return new Promise<string | null>((resolve) => {
            db.admin().serverInfo((err, info) => {
                if (err) {
                    Logger.error(`An error occurred getting mongodb version`, err, AuthController.name)
                    resolve(err)
                } else {
                    resolve(info?.version ? info.version : 'Unknown')
                }
            })
        })
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
        examples: {
            'Login as palpatine': {
                summary: 'Palpatine is a global administrator',
                value: {
                    username: 'palpatine@kyso.io',
                    password: 'n0tiene',
                    provider: 'kyso',
                },
            },
        },
    })
    async login(@Body() login: Login): Promise<NormalizedResponseDTO<string>> {
        const jwt: string = await this.authService.login(login)
        return new NormalizedResponseDTO(jwt)
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
    async loginSSO(@Param('organizationSlug') organizationSlug: string, @Res() response) {
        try {
            // Fetch organizationSlug configuration
            const organization: Organization = await this.organizationsService.getOrganization({
                filter: {
                    name: organizationSlug,
                },
            })

            let pingSamlConfiguration: AuthProviderSpec

            if (
                organization.options &&
                organization.options.auth &&
                organization.options.auth.otherProviders &&
                organization.options.auth.otherProviders.length > 0
            ) {
                pingSamlConfiguration = organization.options.auth.otherProviders.find((x) => x.type === LoginProviderEnum.PING_ID_SAML)
            } else {
                return 'Your organization has not configured PingSAML as auth provider'
            }

            // Set variables to organizationConfiguration
            let authPingIdSamlSsoUrl
            let authPingIdSamlEnvironmentCode
            let authPingIdSPEntityId

            if (pingSamlConfiguration) {
                const options = pingSamlConfiguration.options as PingIdSAMLSpec

                authPingIdSamlSsoUrl = options.sso_url
                authPingIdSamlEnvironmentCode = options.environment_code
                authPingIdSPEntityId = options.sp_entity_id
            } else {
                return 'Your organization has not configured PingSAML as auth provider'
            }

            response.redirect(`${authPingIdSamlSsoUrl}/${authPingIdSamlEnvironmentCode}/saml20/idp/startsso?spEntityId=${authPingIdSPEntityId}`)
        } catch (ex) {
            Logger.error('Error using ping saml auth sso', ex)
            return 'Your organization has not properly configured PingSAML as auth provider'
        }
    }

    @Post('/login/sso/ping-saml/callback')
    async loginSSOCallback(@Req() request, @Res() response) {
        const xmlResponse = request.body.SAMLResponse
        const parser = new Saml2js(xmlResponse)
        const data = parser.toObject()

        if (data && data.samlSubject && data.email && data.portrait && data.name) {
            // Build JWT token and redirect to frontend
            const login: Login = new Login(data.samlSubject, LoginProviderEnum.PING_ID_SAML, data.email, data)

            const jwt = await this.authService.login(login)
            const frontendUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)
            response.redirect(`${frontendUrl}/sso/${jwt}`)
        } else {
            throw new PreconditionFailedException(
                `Incomplete SAML payload received. Kyso requires the following properties: samlSubject, email, portrait and name`,
            )
        }
    }

    @Post('/login/sso/fail')
    @Get('/login/sso/fail')
    async loginSSOFail(@Req() request) {
        console.log(request)
        return 'Failed'
    }

    @Post('/sign-up')
    @ApiOperation({
        summary: `Signs up an user into Kyso`,
        description: `Allows new users to sign-up into Kyso`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Registered user`, type: User })
    public async signUp(@Body() data: CreateUserRequestDTO): Promise<NormalizedResponseDTO<User>> {
        const user: User = await this.usersService.createUser(data)
        return new NormalizedResponseDTO(user)
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
        try {
            const splittedToken = jwtToken.split('Bearer ')
            const decodedToken = this.authService.evaluateAndDecodeToken(splittedToken[1])

            if (decodedToken) {
                const jwt: string = await this.authService.refreshToken(decodedToken)
                return new NormalizedResponseDTO(jwt)
            } else {
                throw new ForbiddenException()
            }
        } catch (ex) {
            throw new ForbiddenException()
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
    async getOrganizationAuthOptions(@Param('organizationSlug') organizationSlug: string) {
        // Fetch organizationSlug configuration
        const organization: Organization = await this.organizationsService.getOrganization({
            filter: {
                sluglified_name: organizationSlug,
            },
        })
        return new NormalizedResponseDTO(organization?.options?.auth)
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
        // If the user is global admin
        const result = new NormalizedResponseDTO(requesterUser.permissions)
        if (requesterUser.isGlobalAdmin()) {
            return result
        }

        // If is not global admin, then only return this info if the requester is the same as the username parameter
        if (requesterUser.username.toLowerCase() === username.toLowerCase()) {
            return result
        } else {
            throw new UnauthorizedException(`The requester user has no rights to access other user permissions`)
        }
    }
}
