import { KysoUserAccessToken, Token, TokenPermissions } from '@kyso-io/kyso-model'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Autowired } from '../../../decorators/autowired'
import { OrganizationsService } from '../../organizations/organizations.service'
import { TeamsService } from '../../teams/teams.service'
import { UsersService } from '../../users/users.service'
import { AuthService, TOKEN_EXPIRATION_TIME } from '../auth.service'
import { PlatformRoleMongoProvider } from './mongo-platform-role.provider'
import { UserRoleMongoProvider } from './mongo-user-role.provider'

@Injectable()
export class KysoLoginProvider {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    constructor(
        private readonly platformRoleProvider: PlatformRoleMongoProvider,
        private readonly jwtService: JwtService,
        private readonly userRoleProvider: UserRoleMongoProvider,
    ) {}

    async login(password: string, username?: string): Promise<string> {
        // Get user from database
        const user = await this.usersService.getUser({
            filter: { username: username },
        })

        if (!user) {
            throw new UnauthorizedException('Unauthorized')
        }

        const isRightPassword = await AuthService.isPasswordCorrect(password, user.hashed_password)

        if (isRightPassword) {
            // Build all the permissions for this user
            const permissions: TokenPermissions = await AuthService.buildFinalPermissionsForUser(
                username,
                this.usersService,
                this.teamsService,
                this.organizationsService,
                this.platformRoleProvider,
                this.userRoleProvider,
            )

            const payload: Token = new Token(
                user.id.toString(),
                user.name,
                user.username,
                user.nickname,
                user.email,
                user.plan,
                permissions,
                user.avatar_url,
                user.location,
                user.link,
                user.bio,
            )

            // generate token
            const token = this.jwtService.sign(
                { payload },
                {
                    expiresIn: TOKEN_EXPIRATION_TIME,
                    issuer: 'kyso',
                },
            )

            return token
        } else {
            throw new UnauthorizedException('Unauthorized')
        }
    }

    async loginWithAccessToken(access_token: string, username?: string): Promise<string> {
        // Get user from database
        const user = await this.usersService.getUser({
            filter: { username: username },
        })

        if (!user) {
            throw new UnauthorizedException('Unauthorized')
        }

        // Search for provided access_token for that user
        const dbAccessToken: KysoUserAccessToken = await this.usersService.searchAccessToken(user.id, access_token)

        if (!dbAccessToken) {
            throw new UnauthorizedException('Unauthorized')
        } else {
            // Build all the permissions for this user
            const permissions: TokenPermissions = await AuthService.buildFinalPermissionsForUser(
                username,
                this.usersService,
                this.teamsService,
                this.organizationsService,
                this.platformRoleProvider,
                this.userRoleProvider,
            )

            // TODO: BUILD PERMISSIONS FROM SCOPE INSTEAD OF FINALPERMISSIONSFORUSER
            const payload: Token = new Token(
                user.id.toString(),
                user.name,
                user.username,
                user.nickname,
                user.email,
                user.plan,
                permissions,
                user.avatar_url,
                user.location,
                user.link,
                user.bio,
            )

            // generate token
            const token = this.jwtService.sign(
                { payload },
                {
                    expiresIn: TOKEN_EXPIRATION_TIME,
                    issuer: 'kyso',
                },
            )

            return token
        }
    }
}
