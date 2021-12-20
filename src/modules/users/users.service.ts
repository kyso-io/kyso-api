import { Injectable, PreconditionFailedException } from '@nestjs/common'
import { User } from 'src/model/user.model'
import { CreateUserRequest } from '../../model/dto/create-user-request.dto'
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
        const parsedUser = User.fromCreateUserRequest(userToCreate)

        // exists a prev user with same email?
        const exists = await this.getUser({ filter: { email: parsedUser.email } })

        if (!exists) {
            // Create user into database
            return (await this.provider.create(parsedUser)) as User
        } else {
            throw new PreconditionFailedException(null, 'User already exists')
        }
    }
}
