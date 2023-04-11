import { NormalizedResponseDTO, Token, User, UserDTO } from '@kyso-io/kyso-model';
import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { GenericController } from '../../generic/controller.generic';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { UsersService } from './users.service';

@ApiTags('user')
@ApiExtraModels(User)
@ApiBearerAuth()
@Controller('user')
export class UserController extends GenericController<User> {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  @Get()
  @ApiOperation({
    summary: `Get the authenticated user`,
    description: `Allows fetching content of the authenticated user`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Authenticated user data`,
    type: User,
  })
  async getAuthenticatedUser(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<UserDTO>> {
    if (!token) {
      throw new ForbiddenException();
    }
    const user: User = await this.usersService.getUserById(token.id);
    if (!user) {
      throw new ForbiddenException(`User not found with this token`);
    }
    return new NormalizedResponseDTO(UserDTO.fromUser(user));
  }
}
