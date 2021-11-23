import { Controller, Get, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { GenericController } from 'src/generic/controller.generic';
import { HateoasLinker } from 'src/helpers/hateoasLinker';
import { QueryParser } from 'src/helpers/queryParser';
import { User } from 'src/model/user.model';

const UPDATABLE_FIELDS = ["email", "nickname", "bio", "accessToken", "access_token"]

@ApiTags('users')
@Controller('users')
export class UsersController extends GenericController<User> {
    constructor(private readonly usersService: UsersService) {
        super();
    }

    assignReferences(user: User) {
        user.self_url = HateoasLinker.createRef(`/users/${user.nickname}`)
    }
    
    @Get("/")
    @ApiOperation({
        summary: 
            `By passing the appropiate parameters you can fetch and filter the users of the platform.
            <b>This endpoint supports filtering</b>. Refer to the User schema to see available options.`,
    })
    @ApiResponse({ status: 200, description: `Users matching criteria`, type: User})
    async getUsers(@Req() req, @Res() res) {    // <-- Lack of documentation due to inconsistent stuff
        const query = QueryParser.toQueryObject(req.url)
        if (!query.sort) query.sort = { _created_at: -1 }
        if (!query.filter) query.filter = {}                // ??? not documented
        if (!query.projection) query.projection = {}        // ??? not documented
        query.projection.accessToken = 0
    
        const users = await this.usersService.getUsers(query)
        users.forEach(x => this.assignReferences(x))
    
        return res.status(200).send(users)
      }
    
    @Get("/:userName")
    @ApiResponse({ status: 200, description: `User matching name`, type: User})
    async getUser(@Param('userName') userName: string) {
        const user = await this.usersService.getUser({
          filter: { nickname: userName },
          projection: { accessToken: 0 }
        })
        
        this.assignReferences(user)
    
        return user
    }
    
    // TODO: This is in /user not in /users... bad naming
    @Get('/loggedIn')
    @ApiResponse({ status: 200, description: `Authenticated user data`, type: User})
    async getAuthenticatedUser(@Req() req, @Res() res) {    // <-- Lack of documentation due to inconsistent stuff
        // TODO: Again, where it comes the req.user.objectId... this is not documented in any place
        const user = await this.usersService.getUserWithSessionAndTeams(req.user.objectId)
        
        this.assignReferences(user)
    
        return res.status(200).send(user)
    }
    
    
    // TODO: Same here, originally this is in /user not in /users... bad naming as well
    @Patch("/")
    async updateAuthenticatedUser(@Req() req, @Res() res) {     // <-- Lack of documentation due to inconsistent stuff
        // TODO: Again, where it comes the req.user.objectId... this is not documented in any place
        const filterObj = { _id: req.user.objectId }

        const fields = Object.fromEntries(Object.entries(req.body).filter(entry => UPDATABLE_FIELDS.includes(entry[0])))
    
        const user = await (Object.keys(fields).length === 0 ? this.usersService.getUser({ filter: filterObj })
          : this.usersService.updateUser(filterObj, { $set: fields }))
    
        return res.status(200).send(user)
    }
}
