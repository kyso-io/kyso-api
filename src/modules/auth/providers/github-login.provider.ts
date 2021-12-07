import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { UsersService } from 'src/modules/users/users.service'
import { JwtService } from '@nestjs/jwt'
import { UnauthorizedError } from 'src/helpers/errorHandling'
import { User } from 'src/model/user.model'
import { GithubReposService } from 'src/modules/github-repos/github-repos.service'
import { PlatformRoleMongoProvider } from './mongo-platform-role.provider'
import { OrganizationsService } from 'src/modules/organizations/organizations.service'
import { TeamsService } from 'src/modules/teams/teams.service'
import { AuthService } from '../auth.service'

const axios = require('axios').default

@Injectable()
export class GithubLoginProvider {
    constructor(
        @Inject(forwardRef(() => UsersService))
        private readonly userService: UsersService,
        private readonly teamService: TeamsService,
        private readonly organizationService: OrganizationsService,
        private readonly platformRoleProvider: PlatformRoleMongoProvider,
        private readonly githubService: GithubReposService,
        private readonly jwtService: JwtService,
    ) {}
    // FLOW:
    //     * After calling login, frontend should call to
    // https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_url=${REDIRECT}&state=${RANDOM_STRING}
    //       to get a temporary code
    //     * Then, frontend should call this method throught the API to get the final JWT
    //     * Finally, should use this JWT for the rest of the methods
    //     * The access_token will be stored in MongoDB, so the next operations could be managed as well
    async login(code: string): Promise<String> {
        const res = await axios.post(
            `https://github.com/login/oauth/access_token`,
            {
                client_id: process.env.AUTH_GITHUB_CLIENT_ID,
                client_secret: process.env.AUTH_GITHUB_CLIENT_SECRET,
                code,
            },
            {
                headers: { 'content-type': 'application/json' },
            },
        )

        if (res.data.includes('error_description')) {
            // We got an error. Thanks Github for returning an error as a 200 ;)
            Logger.error(`Error getting access_token: ${res.data}`)
            throw new UnauthorizedError('')
        }

        // Retrieve the token...
        const access_token = res.data.split('&')[0].split('=')[1]

        const githubUser = await this.githubService.getUserByAccessToken(access_token)
        const emails = await this.githubService.getEmailByAccessToken(access_token)
        const onlyPrimaryMail = emails.filter((x) => x.primary === true)[0]

        const user = User.fromGithubUser(githubUser, onlyPrimaryMail)

        // Get user's detail
        // Check if the user exists in database, and if not, create it
        let userInDb = null
        try {
            userInDb = await this.userService.getUser({
                filter: { email: user.email },
            })
        } catch (ex) {
            Logger.log(`User ${user.username} does not exist at Kyso, creating it`)
        }

        if (userInDb) {
            // User exists, update accessToken
            userInDb.accessToken = access_token
        } else {
            // User does not exists, create it
        }

        // Build all the permissions for this user
        const permissions = await AuthService.buildFinalPermissionsForUser(
            user.username,
            this.userService,
            this.teamService,
            this.organizationService,
            this.platformRoleProvider,
        )

        // In any case, generate JWT Token here
        // generate token
        const token = this.jwtService.sign(
            {
                username: user.username,
                nickname: user.nickname,
                // plan: user.plan,
                id: userInDb.id,
                email: user.email,
                teams: permissions,
            },
            {
                expiresIn: '2h',
                issuer: 'kyso',
            },
        )

        return token
    }
}
