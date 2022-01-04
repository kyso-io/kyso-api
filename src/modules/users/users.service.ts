import { Injectable, PreconditionFailedException } from '@nestjs/common'
import { accessSync } from 'fs'
import { CreateUserRequest } from '../../model/dto/create-user-request.dto'
import { User } from '../../model/user.model'
import { UsersMongoProvider } from './providers/mongo-users.provider'

@Injectable()
export class UsersService {
    constructor(private readonly provider: UsersMongoProvider) {}

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
            let user: User = User.fromCreateUserRequest(userToCreate);
            
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
}
