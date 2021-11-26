import { Injectable } from '@nestjs/common';
import { NotFoundError } from 'src/helpers/errorHandling';
import { UsersMongoProvider } from './providers/mongo-users.provider';
import { TeamsService } from '../teams/teams.service';

@Injectable()
export class UsersService {
    constructor(
        private readonly provider: UsersMongoProvider,
        private readonly teamsService: TeamsService) {
    }
    
    async getUsers(query) {
        let users = []
        if (query.filter && query.filter.team) {
          const team = await this.teamsService.getTeam({ name: query.filter.team })
          delete query.filter.team
    
          users = await this.provider.getUsersFromTeam(query, team)
        } else {
          users = await this.provider.read(query)
        }
    
        return users
      }
    
      async getUser(query) {
        query.limit = 1
        const users = await this.getUsers(query)
        if (users.length === 0) throw new NotFoundError({ message: "The specified user couldn't be found" })
        return users[0]
      }
    
      async getUserWithSessionAndTeams(userId) {
        const users = await this.provider.getUsersWithSessionAndTeams(userId)
        if (users.length === 0) throw new NotFoundError({ message: "The specified user couldn't be found" })
        return users[0]
      }
    
      async updateUser(filterQuery, updateQuery) {
        const user = await this.provider.update(filterQuery, updateQuery)
        return user
      }
}
