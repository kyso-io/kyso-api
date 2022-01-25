import { User } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import axios from 'axios'
import { Autowired } from '../../../decorators/autowired'
import { UnauthorizedError } from '../../../helpers/errorHandling'
import { GithubReposService } from '../../github-repos/github-repos.service'
import { OrganizationsService } from '../../organizations/organizations.service'
import { TeamsService } from '../../teams/teams.service'
import { UsersService } from '../../users/users.service'
import { AuthService } from '../auth.service'
import { PlatformRoleMongoProvider } from './mongo-platform-role.provider'
import { UserRoleMongoProvider } from './mongo-user-role.provider'

@Injectable()
export class GithubLoginProvider {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    @Autowired({ typeName: 'GithubReposService' })
    private githubReposService: GithubReposService

    constructor(
        private readonly platformRoleProvider: PlatformRoleMongoProvider,
        private readonly jwtService: JwtService,
        private readonly userRoleProvider: UserRoleMongoProvider,
    ) {}
    // FLOW:
    //     * After calling login, frontend should call to
    // https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_url=${REDIRECT}&state=${RANDOM_STRING}
    //       to get a temporary code
    //     * Then, frontend should call this method throught the API to get the final JWT
    //     * Finally, should use this JWT for the rest of the methods
    //     * The access_token will be stored in MongoDB, so the next operations could be managed as well
    async login(code: string): Promise<string> {
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

        const githubUser = await this.githubReposService.getUserByAccessToken(access_token)
        const emails = await this.githubReposService.getEmailsByAccessToken(access_token)
        const onlyPrimaryMail = emails.filter((x) => x.primary === true)[0]

        const user = User.fromGithubUser(githubUser, onlyPrimaryMail)

        // Get user's detail
        // Check if the user exists in database, and if not, create it
        let userInDb = null
        try {
            userInDb = await this.usersService.getUser({
                filter: { email: user.email },
            })
        } catch (ex) {
            Logger.log(`User ${user.name} does not exist at Kyso, creating it`)
        }

        if (userInDb) {
            // User exists, update accessToken
            userInDb.accessToken = access_token
        } else {
            // User does not exists, create it
        }

        // Build all the permissions for this user
        const permissions = await AuthService.buildFinalPermissionsForUser(
            user.name,
            this.usersService,
            this.teamsService,
            this.organizationsService,
            this.platformRoleProvider,
            this.userRoleProvider,
        )

        // In any case, generate JWT Token here
        // generate token

        const token = this.jwtService.sign(
            {
                username: user.name,
                nickname: user.nickname,
                id: userInDb.id,
                email: user.email,
                permissions,
            },
            {
                expiresIn: '2h',
                issuer: 'kyso',
            },
        )

        return token
    }
}
