import { CreateUserRequestDTO, Organization, Team, TeamVisibilityEnum, Token, UpdateUserRequestDTO, User, UserAccount } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Injectable, Logger, PreconditionFailedException, Provider } from '@nestjs/common'
import { existsSync, unlinkSync } from 'fs'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { PlatformRole } from '../../security/platform-roles'
import { AuthService } from '../auth/auth.service'
import { CommentsService } from '../comments/comments.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { ReportsService } from '../reports/reports.service'
import { TeamsService } from '../teams/teams.service'
import { UsersMongoProvider } from './providers/mongo-users.provider'

function factory(service: UsersService) {
    return service
}

export function createProvider(): Provider<UsersService> {
    return {
        provide: `${UsersService.name}`,
        useFactory: (service) => factory(service),
        inject: [UsersService],
    }
}

@Injectable()
export class UsersService extends AutowiredService {
    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    @Autowired({ typeName: 'ReportsService' })
    private reportsService: ReportsService

    @Autowired({ typeName: 'CommentsService' })
    private commentsService: CommentsService

    constructor(private mailerService: MailerService, private readonly provider: UsersMongoProvider) {
        super()
    }

    async getUsers(query): Promise<User[]> {
        let users: User[] = []

        users = await this.provider.read(query)

        return users
    }

    public async getUserById(id: string): Promise<User> {
        return this.getUser({ filter: { _id: this.provider.toObjectId(id) } })
    }

    async getUser(query): Promise<User> {
        query.limit = 1
        const users = await this.getUsers(query)
        if (users.length === 0) {
            return null
        }
        return users[0]
    }

    async updateUser(filterQuery: any, updateQuery: any): Promise<User> {
        return this.provider.update(filterQuery, updateQuery)
    }

    async createUser(userToCreate: CreateUserRequestDTO): Promise<User> {
        // exists a prev user with same email?
        const user: User = await this.getUser({ filter: { email: userToCreate.email } })

        if (!userToCreate.password) {
            throw new PreconditionFailedException(null, 'Password unset')
        }

        if (user) {
            throw new PreconditionFailedException(null, 'User already exists')
        }

        // Create user into database
        // Hash the password and delete the plain password property
        const newUser: User = User.fromCreateUserRequest(userToCreate)
        newUser.hashed_password = AuthService.hashPassword(userToCreate.password)
        Logger.log(`Creating new user ${userToCreate.nickname}...`)
        const userDb: User = await this.provider.create(newUser)

        // Create user organization
        const organizationName: string = userDb.nickname.charAt(0).toUpperCase() + userDb.nickname.slice(1) + "'s Workspace"
        const newOrganization: Organization = new Organization(organizationName, organizationName, [], [], userDb.email, '', '', true)
        Logger.log(`Creating new organization ${newOrganization.name}`)
        const organizationDb: Organization = await this.organizationsService.createOrganization(newOrganization)

        // Add user to organization as admin
        Logger.log(`Adding ${userDb.nickname} to organization ${organizationDb.name} with role ${PlatformRole.ORGANIZATION_ADMIN_ROLE.name}...`)
        await this.organizationsService.addMembersById(organizationDb.id, [userDb.id], [PlatformRole.ORGANIZATION_ADMIN_ROLE.name])

        // Create user team
        const teamName: string = userDb.nickname.charAt(0).toUpperCase() + userDb.nickname.slice(1) + "'s Private"
        const newUserTeam: Team = new Team(teamName, '', '', '', '', [], organizationDb.id, TeamVisibilityEnum.PRIVATE)
        Logger.log(`Creating new team ${newUserTeam.name}...`)
        const userTeamDb: Team = await this.teamsService.createTeam(newUserTeam)

        // Add user to team as admin
        Logger.log(`Adding ${userDb.nickname} to team ${userTeamDb.name} with role ${PlatformRole.TEAM_ADMIN_ROLE.name}...`)
        await this.teamsService.addMembersById(userTeamDb.id, [userDb.id], [PlatformRole.TEAM_ADMIN_ROLE.name])

        this.mailerService
            .sendMail({
                to: userDb.email,
                subject: 'Welcome to Kyso',
                html: `Welcome to Kyso, ${userDb.nickname}!`,
            })
            .then(() => {
                Logger.log(`Welcome mail sent to ${userDb.nickname}`, UsersService.name)
            })
            .catch((err) => {
                Logger.error(`Error sending welcome mail to ${userDb.nickname}`, err, UsersService.name)
            })

        return userDb
    }

    async deleteUser(id: string): Promise<boolean> {
        const user: User = await this.getUser({ filter: { _id: this.provider.toObjectId(id) } })
        if (!user) {
            throw new PreconditionFailedException(null, `Can't delete user as does not exists`)
        }

        const teams: Team[] = await this.teamsService.getUserTeams(user.id)
        for (const team of teams) {
            await this.teamsService.removeMemberFromTeam(team.id, user.id)
        }

        const organizations: Organization[] = await this.organizationsService.getUserOrganizations(user.id)
        for (const organization of organizations) {
            await this.organizationsService.removeMemberFromOrganization(organization.id, user.id)
        }

        // Delete starred reports
        await this.reportsService.deleteStarredReportsByUser(user.id)

        // Delete pinned reports
        await this.reportsService.deletePinnedReportsByUser(user.id)

        // Delete comments
        await this.commentsService.deleteUserComments(user.id)

        await this.provider.deleteOne({ _id: this.provider.toObjectId(id) })
        return true
    }

    public async addAccount(id: string, userAccount: UserAccount): Promise<boolean> {
        const user: User = await this.getUser(
            { filter: { _id: this.provider.toObjectId(id) }
        })

        if (!user) {
            throw new PreconditionFailedException(null, `Can't add account to user as does not exists`)
        }
        if (!user.hasOwnProperty('accounts')) {
            user.accounts = []
        }
        const index: number = user.accounts.findIndex(
            (account: UserAccount) => account.accountId === userAccount.accountId && account.type === userAccount.type,
        )
        if (index !== -1) {
            throw new PreconditionFailedException(null, `The user has already registered this account`)
        } else {
            const userAccounts: UserAccount[] = [...user.accounts, userAccount]
            await this.updateUser({ _id: this.provider.toObjectId(id) }, { $set: { accounts: userAccounts } })
        }
        return true
    }

    public async removeAccount(id: string, provider: string, accountId: string): Promise<boolean> {
        const user = await this.getUser({ filter: { _id: this.provider.toObjectId(id) } })

        if (!user) {
            throw new PreconditionFailedException(null, `Can't remove account to user as does not exists`)
        }
        if (!user.hasOwnProperty('accounts')) {
            user.accounts = []
        }
        const index: number = user.accounts.findIndex((account: UserAccount) => account.accountId === accountId && account.type === provider)
        if (index !== -1) {
            const userAccounts: UserAccount[] = [...user.accounts.slice(0, index), ...user.accounts.slice(index + 1)]
            await this.updateUser({ _id: this.provider.toObjectId(id) }, { $set: { accounts: userAccounts } })
        } else {
            throw new PreconditionFailedException(null, `The user has not registered this account`)
        }
        return true
    }

    public async updateUserData(id: string, data: UpdateUserRequestDTO): Promise<User> {
        const user: User = await this.getUser({ filter: { _id: this.provider.toObjectId(id) } })
        if (!user) {
            throw new PreconditionFailedException(null, `Can't update user as does not exists`)
        }
        return this.updateUser({ _id: this.provider.toObjectId(id) }, { $set: data })
    }

    // Commented type throwing an Namespace 'global.Express' has no exported member 'Multer' error
    public async setProfilePicture(token: Token, file: any /*Express.Multer.File*/): Promise<User> {
        const user: User = await this.getUser({ filter: { _id: this.provider.toObjectId(token.id) } })
        if (!user) {
            throw new PreconditionFailedException('User not found')
        }
        if (user?.avatar_url && user.avatar_url.length > 0) {
            const imagePath = `./public/${user.avatar_url}`
            if (existsSync(imagePath)) {
                unlinkSync(imagePath)
            }
        }
        const profilePicturePath: string = file.path.replace('public/', '')
        return this.provider.update({ _id: this.provider.toObjectId(user.id) }, { $set: { avatar_url: profilePicturePath } })
    }

    public async deleteProfilePicture(token: Token): Promise<User> {
        const user: User = await this.getUser({ filter: { _id: this.provider.toObjectId(token.id) } })
        if (!user) {
            throw new PreconditionFailedException('User not found')
        }
        if (user?.avatar_url && user.avatar_url.length > 0) {
            const imagePath = `./public/${user.avatar_url}`
            if (existsSync(imagePath)) {
                unlinkSync(imagePath)
            }
        }
        return this.provider.update({ _id: this.provider.toObjectId(user.id) }, { $set: { avatar_url: null } })
    }
}
