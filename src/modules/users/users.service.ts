import { MailerService } from '@nestjs-modules/mailer'
import { Injectable, Logger, PreconditionFailedException, Provider } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { CreateUserRequest } from '../../model/dto/create-user-request.dto'
import { UpdateUserRequest } from '../../model/dto/update-user-request.dto'
import { TeamVisibilityEnum } from '../../model/enum/team-visibility.enum'
import { KysoRole } from '../../model/kyso-role.model'
import { Organization } from '../../model/organization.model'
import { Team } from '../../model/team.model'
import { UserAccount } from '../../model/user-account'
import { User } from '../../model/user.model'
import { OrganizationsService } from '../organizations/organizations.service'
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
    @Autowired({ typeName: "OrganizationsService" })
    private organizationsService: OrganizationsService
    
    @Autowired({ typeName: "TeamsService" })
    private teamsService: TeamsService

    constructor(private mailerService: MailerService, private readonly provider: UsersMongoProvider) {
        super()
    }

    async getUsers(query): Promise<User[]> {
        let users: User[] = []

        users = await this.provider.read(query)

        return users
    }

    async getUser(query): Promise<User> {
        query.limit = 1
        const users = await this.getUsers(query)
        if (users.length === 0) {
            return null
        }
        return users[0]
    }

    async updateUser(filterQuery, updateQuery): Promise<User> {
        return (await this.provider.update(filterQuery, updateQuery)) as User
    }

    async createUser(userToCreate: CreateUserRequest): Promise<User> {
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
        Logger.log(`Creating new user ${userToCreate.nickname}...`)
        const userDb: User = await this.provider.create(newUser)

        // Create user organization
        const organizationName: string = userDb.username.charAt(0).toUpperCase() + userDb.username.slice(1) + "'s Workspace"
        const newOrganization: Organization = new Organization(organizationName, [], userDb.email, uuidv4(), false)
        Logger.log(`Creating new organization ${newOrganization.name}`)
        const organizationDb: Organization = await this.organizationsService.createOrganization(newOrganization)

        // Add user to organization as admin
        Logger.log(`Adding ${userDb.nickname} to organization ${organizationDb.name} with role ${KysoRole.ORGANIZATION_ADMIN_ROLE.name}...`)
        await this.organizationsService.addMembersById(organizationDb.id, [userDb.id], [KysoRole.ORGANIZATION_ADMIN_ROLE.name])

        // Create user team
        const teamName: string = userDb.username.charAt(0).toUpperCase() + userDb.username.slice(1) + "'s Private"
        const newUserTeam: Team = new Team(teamName, null, null, null, [], organizationDb.id, TeamVisibilityEnum.PRIVATE)
        Logger.log(`Creating new team ${newUserTeam.name}...`)
        const userTeamDb: Team = await this.teamsService.createTeam(newUserTeam)

        // Add user to team as admin
        Logger.log(`Adding ${userDb.nickname} to team ${userTeamDb.name} with role ${KysoRole.TEAM_ADMIN_ROLE.name}...`)
        await this.teamsService.addMembersById(userTeamDb.id, [userDb.id], [KysoRole.TEAM_ADMIN_ROLE.name])

        this.mailerService
            .sendMail({
                to: userDb.email,
                subject: 'Welcome to Kyso',
                html: `Welcome to Kyso, ${userDb.username}!`,
            })
            .then(() => {
                Logger.log(`Welcome mail sent to ${userDb.username}`, UsersService.name)
            })
            .catch((err) => {
                Logger.error(`Error sending welcome mail to ${userDb.username}`, err, UsersService.name)
            })

        return userDb
    }

    async deleteUser(email: string) {
        const exists = await this.getUser({ filter: { email: email } })

        if (!exists) {
            throw new PreconditionFailedException(null, `Can't delete user as does not exists`)
        } else {
            this.provider.delete({ email: email })
        }
    }

    public async addAccount(email: string, userAccount: UserAccount): Promise<boolean> {
        const user = await this.getUser({ filter: { email: email } })

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
            await this.updateUser({ email: email }, { $set: { accounts: userAccounts } })
        }
        return true
    }

    public async removeAccount(email: string, provider: string, accountId: string): Promise<boolean> {
        const user = await this.getUser({ filter: { email: email } })

        if (!user) {
            throw new PreconditionFailedException(null, `Can't remove account to user as does not exists`)
        }
        if (!user.hasOwnProperty('accounts')) {
            user.accounts = []
        }
        const index: number = user.accounts.findIndex((account: UserAccount) => account.accountId === accountId && account.type === provider)
        if (index !== -1) {
            const userAccounts: UserAccount[] = [...user.accounts.slice(0, index), ...user.accounts.slice(index + 1)]
            await this.updateUser({ email: email }, { $set: { accounts: userAccounts } })
        } else {
            throw new PreconditionFailedException(null, `The user has not registered this account`)
        }
        return true
    }

    public async updateUserData(email: string, data: UpdateUserRequest): Promise<User> {
        const user: User = await this.getUser({ filter: { email } })
        if (!user) {
            throw new PreconditionFailedException(null, `Can't update user as does not exists`)
        }
        return this.updateUser({ email: email }, { $set: data })
    }
}
