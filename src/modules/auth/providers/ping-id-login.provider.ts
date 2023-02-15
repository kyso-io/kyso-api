import { CreateUserRequestDTO, Login, LoginProviderEnum, SignUpDto } from '@kyso-io/kyso-model';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UploadImageDto } from 'src/dtos/upload-image.dto';
import slugify from '../../../helpers/slugify';
import { BaseLoginProvider } from './base-login.provider';

@Injectable()
export class PingIdLoginProvider extends BaseLoginProvider {
  constructor(protected readonly jwtService: JwtService) {
    super(jwtService);
  }

  public async login(login: Login): Promise<string> {
    Logger.log(`User ${login.email} is trying to login with PingId`);

    try {
      let user = await this.usersService.getUser({
        filter: { email: login.email },
      });

      if (!user) {
        // New User
        const name = `${login.payload.givenName} ${login.payload.sn}`;
        const portrait = login.payload.profilePicture ? login.payload.profilePicture : '';
        Logger.log(`User ${login.email} is a new user`);

        // User does not exists, create it
        const signup = new SignUpDto(login.email, slugify(login.email), name, login.password);

        /*
        const createUserRequestDto: CreateUserRequestDTO = new CreateUserRequestDTO(
          login.email,
          slugify(login.email),
          name,
          name,
          LoginProviderEnum.PING_ID_SAML,
          '',
          '',
          '',
          'free',
          portrait,
          null,
          true, // If comes from PingID is an enterprise user, that means we can assume is verified
          [],
          login.password,
        );
        */

        user = await this.usersService.createUser(signup, LoginProviderEnum.PING_ID_SAML);
        user = await this.usersService.updateUser(
          { id: user.id },
          {
            $set: {
              avatar_url: portrait,
            },
          },
        );
      }

      return await this.createToken(user);
    } catch (e) {
      Logger.error('Exception login with PingID', e);
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}
