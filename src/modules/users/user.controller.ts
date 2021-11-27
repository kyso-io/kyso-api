import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { GenericController } from 'src/generic/controller.generic';
import { HateoasLinker } from 'src/helpers/hateoasLinker';
import { User } from 'src/model/user.model';
import { UpdateUserRequest } from './dto/update-user-request.dto';

const UPDATABLE_FIELDS = ["email", "nickname", "bio", "accessToken", "access_token"]

@ApiTags('user')
@Controller('user')
export class UserController extends GenericController<User> {
    constructor(private readonly usersService: UsersService) {
        super();
    }

    assignReferences(user: User) {
        user.self_url = HateoasLinker.createRef(`/users/${user.nickname}`)
    }
    
    // TODO: This is in /user not in /users... bad naming, and the design is poor. For now, keep as is to don't break
    // the frontend
    @Get('')
    @ApiOperation({
        summary: 
            `Allows fetching content of the authenticated user`,
    })
    @ApiResponse({ status: 200, description: `Authenticated user data`, type: User})
    async getAuthenticatedUser(@Req() req, @Res() res) {    // <-- Lack of documentation due to inconsistent stuff
        // TODO: Again, where it comes the req.user.objectId... this is not documented in any place
        const user = await this.usersService.getUserWithSessionAndTeams(req.user.objectId)
        
        this.assignReferences(user)
    
        return res.status(200).send(user)
    }
    
    
    // TODO: Same here, originally this is in /user not in /users... bad naming as well
    @Patch("/")
    @ApiOperation({
        summary: 
            `Allows updating content from the authenticated user`,
    })
    @ApiResponse({ status: 200, description: `Updated used data`, type: User})
    async updateAuthenticatedUser(@Req() req, @Res() res, @Body() userToUpdate: UpdateUserRequest) {     // <-- Lack of documentation due to inconsistent stuff
        // TODO: Again, where it comes the req.user.objectId... this is not documented in any place
        // TODO: userToUpdate is there only for documentation purposes, but would be great to refactor this to user that object
        //       instead of the plan @Req and @Res objects
        const filterObj = { _id: req.user.objectId }

        const fields = Object.fromEntries(Object.entries(req.body).filter(entry => UPDATABLE_FIELDS.includes(entry[0])))
    
        const user = await (Object.keys(fields).length === 0 ? this.usersService.getUser({ filter: filterObj })
          : this.usersService.updateUser(filterObj, { $set: fields }))
    
        return res.status(200).send(user)
    }
}
