import { Login, LoginProviderEnum, SignUpDto } from '@kyso-io/kyso-model';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import slugify from '../../../helpers/slugify';
import { BaseLoginProvider } from './base-login.provider';

@Injectable()
export class OktaLoginProvider extends BaseLoginProvider {
  constructor(protected readonly jwtService: JwtService) {
    super(jwtService);
  }

  public async login(login: Login): Promise<string> {
    Logger.log(`User ${login.email} is trying to login with Okta`);

    try {
      let user = await this.usersService.getUser({
        filter: { email: login.email },
      });

      if (!user) {
        // New User
        Logger.log(`User ${login.email} is a new user`);

        let name = '';
        if (
          login.payload.hasOwnProperty('saml2p:Response') &&
          login.payload['saml2p:Response'].hasOwnProperty('saml2:Assertion') &&
          login.payload['saml2p:Response']['saml2:Assertion'].hasOwnProperty('saml2:AttributeStatement') &&
          login.payload['saml2p:Response']['saml2:Assertion']['saml2:AttributeStatement'].hasOwnProperty('saml2:Attribute')
        ) {
          const attributes = login.payload['saml2p:Response']['saml2:Assertion']['saml2:AttributeStatement']['saml2:Attribute'];
          const firstNameAttribute = attributes.find((attribute) => attribute['@_Name'] === 'firstName');
          if (firstNameAttribute && firstNameAttribute.hasOwnProperty('saml2:AttributeValue') && firstNameAttribute['saml2:AttributeValue'].hasOwnProperty('#text')) {
            name = firstNameAttribute['saml2:AttributeValue']['#text'];
          }
          const lastNameAttribute = attributes.find((attribute) => attribute['@_Name'] === 'lastName');
          if (lastNameAttribute && lastNameAttribute.hasOwnProperty('saml2:AttributeValue') && lastNameAttribute['saml2:AttributeValue'].hasOwnProperty('#text')) {
            name += ' ' + lastNameAttribute['saml2:AttributeValue']['#text'];
          }
        } else {
          name = login.email;
        }
        // User does not exists, create it
        const signup = new SignUpDto(login.email, slugify(login.email), name, login.password);
        user = await this.usersService.createUser(signup, LoginProviderEnum.OKTA_SAML);
      }

      return await this.createToken(user);
    } catch (e) {
      Logger.error('Exception login with Okta', e);
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}
