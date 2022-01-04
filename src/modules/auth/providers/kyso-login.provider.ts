import { forwardRef, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { TokenPermissions } from '../../../model/token-permissions.model'
import { Token } from '../../../model/token.model'
import { OrganizationsService } from '../../organizations/organizations.service'
import { TeamsService } from '../../teams/teams.service'
import { UsersService } from '../../users/users.service'
import { AuthService } from '../auth.service'
import { PlatformRoleMongoProvider } from './mongo-platform-role.provider'
import { UserRoleMongoProvider } from './mongo-user-role.provider'

@Injectable()
export class KysoLoginProvider {
    constructor(
        @Inject(forwardRef(() => UsersService))
        private readonly userService: UsersService,
        private readonly teamService: TeamsService,
        private readonly organizationService: OrganizationsService,
        private readonly platformRoleProvider: PlatformRoleMongoProvider,
        private readonly jwtService: JwtService,
        private readonly userRoleProvider: UserRoleMongoProvider,
    ) {}

    async login(password: string, username?: string): Promise<string> {
        // Get user from database
        const user = await this.userService.getUser({
            filter: { username: username },
        })

        if(!user) {
            throw new UnauthorizedException("Unauthorized")
        }

        const isRightPassword = await AuthService.isPasswordCorrect(password, user.hashed_password)

        if (isRightPassword) {
            // Build all the permissions for this user
            const permissions: TokenPermissions = await AuthService.buildFinalPermissionsForUser(
                username,
                this.userService,
                this.teamService,
                this.organizationService,
                this.platformRoleProvider,
                this.userRoleProvider,
            )

            const payload: Token = new Token(user.id.toString(), user.username, user.nickname, user.email, user.plan, permissions, user.avatar_url)

            // generate token
            const token = this.jwtService.sign(
                { payload },
                {
                    expiresIn: '2h',
                    issuer: 'kyso',
                },
            )

            return token
        } else {
            throw new UnauthorizedException("Unauthorized")
        }
    }
}
