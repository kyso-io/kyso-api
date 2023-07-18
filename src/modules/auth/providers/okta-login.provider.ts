import { KysoSettingsEnum, Login, LoginProviderEnum, SignUpDto } from '@kyso-io/kyso-model';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Autowired } from '../../../decorators/autowired';
import slugify from '../../../helpers/slugify';
import { KysoSettingsService } from '../../kyso-settings/kyso-settings.service';
import { BaseLoginProvider } from './base-login.provider';

@Injectable()
export class OktaLoginProvider extends BaseLoginProvider {
  @Autowired({ typeName: 'KysoSettingsService' })
  public readonly kysoSettingsService: KysoSettingsService;

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
        const mappings: { [key: string]: string[] } = (await this.kysoSettingsService.getValue(KysoSettingsEnum.OKTA_SAML_USER_MAPPING)) as any;
        const nameParts: string[] = [];
        let attributes: any | null;
        if (
          login.payload.hasOwnProperty('saml2p:Response') &&
          login.payload['saml2p:Response'].hasOwnProperty('saml2:Assertion') &&
          login.payload['saml2p:Response']['saml2:Assertion'].hasOwnProperty('saml2:AttributeStatement') &&
          login.payload['saml2p:Response']['saml2:Assertion']['saml2:AttributeStatement'].hasOwnProperty('saml2:Attribute')
        ) {
          attributes = login.payload['saml2p:Response']['saml2:Assertion']['saml2:AttributeStatement']['saml2:Attribute'];
          for (const key of mappings['name']) {
            const attribute: any | null = attributes.find((attr: any) => attr['@_Name'] === key);
            if (attribute && attribute.hasOwnProperty('saml2:AttributeValue') && attribute['saml2:AttributeValue'].hasOwnProperty('#text')) {
              nameParts.push(attribute['saml2:AttributeValue']['#text']);
            }
          }
        }
        if (nameParts.length === 0) {
          nameParts.push(login.email);
        }
        // User does not exists, create it
        const signUpDto: SignUpDto = new SignUpDto(login.email, slugify(login.email), nameParts.join(' '), login.password);
        user = await this.usersService.createUser(signUpDto, LoginProviderEnum.OKTA_SAML);
        if (attributes !== null) {
          const userDataToUpdate = {};
          for (const userProperty of ['avatar_url', 'display_name', 'bio', 'link', 'location']) {
            const parts: string[] = [];
            for (const key of mappings[userProperty]) {
              const attribute: any | null = attributes.find((attr: any) => attr['@_Name'] === key);
              if (attribute && attribute.hasOwnProperty('saml2:AttributeValue') && attribute['saml2:AttributeValue'].hasOwnProperty('#text')) {
                parts.push(attribute['saml2:AttributeValue']['#text']);
              }
            }
            if (parts.length > 0) {
              userDataToUpdate[userProperty] = parts.join(' ');
            }
          }
          if (Object.keys(userDataToUpdate).length > 0) {
            await this.usersService.updateUser({ id: user.id }, { $set: userDataToUpdate });
          }
        }
      }
      return await this.createToken(user);
    } catch (e) {
      Logger.error('Exception login with Okta', e);
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}
