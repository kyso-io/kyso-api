import { Injectable, PreconditionFailedException } from '@nestjs/common'
import { User } from 'src/model/user.model'
import { CreateUserRequest } from '../../model/dto/create-user-request.dto'
import { AuthService } from '../auth/auth.service'
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

    async createUser(userToCreate: User): Promise<User> {
        // exists a prev user with same email?
        const exists = await this.getUser({ filter: { email: userToCreate.email } })

        if (!userToCreate.password) {
            throw new PreconditionFailedException(null, 'Password unset')
        }

        if (!exists) {
            // Create user into database
            // Hash the password and delete the plain password property
            const hashedPassword = AuthService.hashPassword(userToCreate.password)

            userToCreate.hashed_password = hashedPassword
            delete userToCreate.password

            return (await this.provider.create(userToCreate)) as User
        } else {
            throw new PreconditionFailedException(null, 'User already exists')
        }
    }
}
