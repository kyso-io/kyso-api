import { Injectable, PreconditionFailedException, Provider } from '@nestjs/common'
import { AutowiredService } from '../../generic/autowired.generic'
import { CreateUserRequest } from '../../model/dto/create-user-request.dto'
import { UserAccount } from '../../model/user-account'
import { User } from '../../model/user.model'
import { UsersMongoProvider } from './providers/mongo-users.provider'

function factory(service: UsersService) {
    return service;
}
  
export function createProvider(): Provider<UsersService> {
    return {
        provide: `${UsersService.name}`,
        useFactory: service => factory(service),
        inject: [UsersService],
    };
}

@Injectable()
export class UsersService extends AutowiredService {
    constructor(private readonly provider: UsersMongoProvider) {
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
        const exists = await this.getUser({ filter: { email: userToCreate.email } })

        if (!userToCreate.password) {
            throw new PreconditionFailedException(null, 'Password unset')
        }

        if (!exists) {
            // Create user into database
            // Hash the password and delete the plain password property
            const user: User = User.fromCreateUserRequest(userToCreate)

            return (await this.provider.create(user)) as User
        } else {
            throw new PreconditionFailedException(null, 'User already exists')
        }
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
}
