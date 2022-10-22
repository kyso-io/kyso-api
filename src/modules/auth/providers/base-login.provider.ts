import { AddUserOrganizationDto, KysoSettingsEnum, Organization, Token, User, UserAccount } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OrganizationsService } from 'src/modules/organizations/organizations.service';
import { PlatformRole } from 'src/security/platform-roles';
import { Autowired } from '../../../decorators/autowired';
import { KysoSettingsService } from '../../kyso-settings/kyso-settings.service';

@Injectable()
export class BaseLoginProvider {
  @Autowired({ typeName: 'OrganizationsService' })
  protected organizationsService: OrganizationsService;

  @Autowired({ typeName: 'KysoSettingsService' })
  protected kysoSettingsService: KysoSettingsService;

  constructor(protected readonly jwtService: JwtService) {}

  public async createToken(user: User): Promise<string> {
    const payload: Token = new Token(
      user.id.toString(),
      user.name,
      user.username,
      user.display_name,
      user.email,
      user.plan,
      user.avatar_url,
      user.location,
      user.link,
      user.bio,
      user.email_verified,
      user.show_captcha,
      user.accounts.map((userAccount: UserAccount) => ({
        type: userAccount.type,
        accountId: userAccount.accountId,
        username: userAccount.username,
      })),
    );
    const tokenExpirationTimeInHours: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.DURATION_HOURS_JWT_TOKEN);
    return this.jwtService.sign(
      { payload },
      {
        expiresIn: `${tokenExpirationTimeInHours}h`,
        issuer: 'kyso',
      },
    );
  }

  public async addUserToOrganizationsAutomatically(user: User): Promise<void> {
    const automaticOrgs = await this.kysoSettingsService.getValue(KysoSettingsEnum.ADD_NEW_USERS_AUTOMATICALLY_TO_ORG);
    if (automaticOrgs) {
      Logger.log(`Adding ${user.email} as TEAM_READER automatically to the following orgs ${automaticOrgs}`);
      const splittedOrgs = automaticOrgs.split(',');
      for (const organizationSlug of splittedOrgs) {
        const org: Organization = await this.organizationsService.getOrganization({
          filter: {
            sluglified_name: organizationSlug,
          },
        });
        if (!org) {
          Logger.error(`Organization ${organizationSlug} not found`);
          continue;
        }
        const addUserOrganizationDto: AddUserOrganizationDto = new AddUserOrganizationDto();
        addUserOrganizationDto.organizationId = org.id;
        addUserOrganizationDto.role = PlatformRole.TEAM_READER_ROLE.name;
        addUserOrganizationDto.userId = user.id;
        await this.organizationsService.addMemberToOrganization(addUserOrganizationDto);
      }
    }
  }
}
