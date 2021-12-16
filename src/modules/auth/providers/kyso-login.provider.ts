import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { UsersService } from 'src/modules/users/users.service'
import { JwtService } from '@nestjs/jwt'
import { TeamsService } from 'src/modules/teams/teams.service'
import { AuthService } from '../auth.service'
import { OrganizationsService } from 'src/modules/organizations/organizations.service'
import { PlatformRoleMongoProvider } from './mongo-platform-role.provider'
import { UserRoleMongoProvider } from './mongo-user-role.provider'
import { Token } from '../model/token.model'
import { TokenPermissions } from '../model/token-permissions.model'

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

    async login(password: string, username?: string): Promise<String> {
        // Get user from database
        let user = await this.userService.getUser({
            filter: { username: username },
        })

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

            let payload: Token = new Token()

            payload.username = user.username
            payload.nickname = user.nickname
            payload.id = user.id.toString()
            payload.plan = user.plan
            payload.email = user.email
            payload.permissions = permissions

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
            // throw unauthorized exception
        }
    }
}
