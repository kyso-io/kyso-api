import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { UsersService } from 'src/modules/users/users.service'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { TeamsService } from 'src/modules/teams/teams.service'
import { AuthService } from '../auth.service'

@Injectable()
export class KysoLoginProvider {
    constructor(
        @Inject(forwardRef(() => UsersService))
        private readonly userService: UsersService, 
        @Inject(forwardRef(() => AuthService))
        private readonly authService: AuthService,
        private readonly jwtService: JwtService) {}

    async login(password: string, username?: string): Promise<String> {
        // Get user from database
        let user = await this.userService.getUser({
            filter: { username: username },
        })

        const isRightPassword = await bcrypt.compare(password, user.hashed_password)

        if (isRightPassword) {
            // Build all the permissions for this user
            const permissions = await this.authService.buildFinalPermissionsForUser(username)

            // generate token
            const token = this.jwtService.sign(
                {
                    username: user.username,
                    nickname: user.nickname,
                    plan: user.plan,
                    id: user.id,
                    email: user.email,
                    direct_permissions: user.direct_permissions,
                    teams: permissions,
                },
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
