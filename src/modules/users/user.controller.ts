import { Body, Controller, Get, Headers, Logger, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { GenericController } from 'src/generic/controller.generic'
import { HateoasLinker } from 'src/helpers/hateoasLinker'
import { User } from 'src/model/user.model'
import { UpdateUserRequest } from './dto/update-user-request.dto'
import { Permission } from '../auth/annotations/permission.decorator'
import { UserPermissionsEnum } from './security/user-permissions.enum'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { AuthService } from '../auth/auth.service'

const UPDATABLE_FIELDS = ['email', 'nickname', 'bio', 'accessToken', 'access_token']

@ApiTags('user')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('user')
export class UserController extends GenericController<User> {
    constructor(private readonly usersService: UsersService, private readonly authService: AuthService) {
        super()
    }

    assignReferences(user: User) {
        user.self_url = HateoasLinker.createRef(`/users/${user.nickname}`)
    }

    // TODO: This is in /user not in /users... bad naming, and the design is poor. For now, keep as is to don't break
    // the frontend
    @Get('')
    @ApiOperation({
        summary: `Get the authenticated user`,
        description: `Allows fetching content of the authenticated user`,
    })
    @ApiResponse({
        status: 200,
        description: `Authenticated user data`,
        type: User,
    })
    async getAuthenticatedUser(@Headers('authorization') authorizationHeader: string) {
        const token = authorizationHeader.split('Bearer ')[1]

        const payload = this.authService.evaluateAndDecodeToken(token)

        const user = (await this.usersService.getUser({ filter: { username: payload.username } })) as User

        this.assignReferences(user)

        return user
    }

    // TODO: Same here, originally this is in /user not in /users... bad naming as well
    @Patch('/')
    @ApiOperation({
        summary: `Update the authenticated user`,
        description: `Allows updating content from the authenticated user`,
    })
    @ApiResponse({ status: 200, description: `Updated used data`, type: User })
    @Permission([UserPermissionsEnum.EDIT])
    async updateAuthenticatedUser(@Req() req, @Res() res, @Body() userToUpdate: UpdateUserRequest) {
        // <-- Lack of documentation due to inconsistent stuff
        // TODO: Again, where it comes the req.user.objectId... this is not documented in any place
        // TODO: userToUpdate is there only for documentation purposes, but would be great to refactor this to user that object
        //       instead of the plan @Req and @Res objects
        const filterObj = { _id: req.user.objectId }

        const fields = Object.fromEntries(Object.entries(req.body).filter((entry) => UPDATABLE_FIELDS.includes(entry[0])))

        const user = await (Object.keys(fields).length === 0
            ? this.usersService.getUser({ filter: filterObj })
            : this.usersService.updateUser(filterObj, { $set: fields }))

        return res.status(200).send(user)
    }
}
