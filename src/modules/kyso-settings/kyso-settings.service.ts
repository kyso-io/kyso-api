import { KysoSetting, KysoSettingsEnum, UpdateKysoSettingDto } from '@kyso-io/kyso-model';
import { Injectable, Provider } from '@nestjs/common';
import { AutowiredService } from '../../generic/autowired.generic';
import { KysoSettingsMongoProvider } from './providers/kyso-settings-mongo.provider';

function factory(service: KysoSettingsService) {
  return service;
}

export function createProvider(): Provider<KysoSettingsService> {
  return {
    provide: `${KysoSettingsService.name}`,
    useFactory: (service) => factory(service),
    inject: [KysoSettingsService],
  };
}

@Injectable()
export class KysoSettingsService extends AutowiredService {
  constructor(private readonly provider: KysoSettingsMongoProvider) {
    super();
  }

  public async getAll(): Promise<KysoSetting[]> {
    return this.provider.read({});
  }

  public async getValue(key: KysoSettingsEnum): Promise<string> {
    const result: KysoSetting[] = await this.provider.read({ filter: { key: key } });
    if (result.length === 1) {
      return result[0].value;
    } else {
      return null;
    }
  }

  public async updateValue(key: KysoSettingsEnum, updateKysoSettingDto: UpdateKysoSettingDto): Promise<KysoSetting> {
    const dataFields = {
      value: updateKysoSettingDto.value,
    };
    return this.provider.update({ key: key }, { $set: dataFields });
  }

  public static getKysoSettingDefaultValue(setting: KysoSettingsEnum): string {
    switch (setting) {
      case KysoSettingsEnum.BITBUCKET_API:
        return 'https://api.bitbucket.org/2.0';
      case KysoSettingsEnum.BASE_URL:
        return 'http://localhost.kyso.io:4000';
      case KysoSettingsEnum.FRONTEND_URL:
        return 'http://localhost:3000';
      case KysoSettingsEnum.KYSO_FILES_CLOUDFRONT_URL:
        return 'https://d1kser01wv8mbw.cloudfront.net';
      case KysoSettingsEnum.AWS_REGION:
        return 'us-east-1';
      case KysoSettingsEnum.MAIL_TRANSPORT:
        return 'smtps://dev@dev.kyso.io:sphere6wrap&toxic@mailu.kyso.io';
      case KysoSettingsEnum.MAIL_FROM:
        return '"kyso" <dev@dev.kyso.io>';
      case KysoSettingsEnum.ELASTICSEARCH_URL:
        return 'http://elasticsearch:9200';
      case KysoSettingsEnum.DURATION_HOURS_JWT_TOKEN:
        return '8';
      case KysoSettingsEnum.DURATION_HOURS_TOKEN_EMAIL_VERIFICATION:
        return '2';
      case KysoSettingsEnum.DURATION_MINUTES_TOKEN_RECOVERY_PASSWORD:
        return '15';
      case KysoSettingsEnum.HCAPTCHA_ENABLED:
        return 'false';
      case KysoSettingsEnum.HCAPTCHA_SITE_KEY:
        // Development default from
        // https://docs.hcaptcha.com/#integration-testing-test-keys
        return '10000000-ffff-ffff-ffff-000000000001';
      case KysoSettingsEnum.HCAPTCHA_SECRET_KEY:
        // Development default from
        // https://docs.hcaptcha.com/#integration-testing-test-keys
        return '0x0000000000000000000000000000000000000000';
      case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_GOOGLE:
        return 'true';
      case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_GITLAB:
        return 'true';
      case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_BITBUCKET:
        return 'true';
      case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_KYSO:
        return 'true';
      case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_GITHUB:
        return 'true';
      case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_PINGID_SAML:
        return 'false';
      case KysoSettingsEnum.KYSO_INDEXER_API_BASE_URL:
        return 'http://kyso-scs:8080';
      case KysoSettingsEnum.UNAUTHORIZED_REDIRECT_URL:
        return '/login';
      case KysoSettingsEnum.KYSO_NATS_URL:
        return 'nats://nats:4222';
      case KysoSettingsEnum.ADD_NEW_USERS_AUTOMATICALLY_TO_ORG:
        return '';
      case KysoSettingsEnum.MAX_FILE_SIZE:
        return '500mb';
      case KysoSettingsEnum.MAX_ORGANIZATIONS_PER_USER:
        return '5';
      case KysoSettingsEnum.MAX_TEAMS_PER_USER:
        return '20';
      case KysoSettingsEnum.KYSO_WEBHOOK_URL:
        return '';
      case KysoSettingsEnum.THEME:
        return 'default';
      case KysoSettingsEnum.ENABLE_INVITATION_LINKS_GLOBALLY:
        return 'false';
      case KysoSettingsEnum.GLOBAL_PRIVACY_SHOW_EMAIL:
        return 'true';
      default:
        return '';
    }
  }

  public static getKysoSettingDescription(setting: KysoSettingsEnum): string {
    switch (setting) {
      case KysoSettingsEnum.KYSO_FILES_CLOUDFRONT_URL:
        return 'Cloudfront service for Kyso';
      case KysoSettingsEnum.AWS_REGION:
        return 'AWS Region in which this instance of Kyso will operate. i.e: us-east-1';
      case KysoSettingsEnum.AWS_S3_BUCKET:
        return "Name of the AWS S3 Bucket which will store Kyso's data. i.e: kyso-user-files-east";
      case KysoSettingsEnum.AWS_ACCESS_KEY_ID:
        return 'Access Key Identificator por AWS S3';
      case KysoSettingsEnum.AWS_SECRET_ACCESS_KEY:
        return 'Secret to connect to AWS S3';
      case KysoSettingsEnum.AUTH_BITBUCKET_CLIENT_ID:
        return 'Client ID used for OAUTH2 authentication using Bitbucket provider';
      case KysoSettingsEnum.AUTH_BITBUCKET_CLIENT_SECRET:
        return 'Secret used for OAUTH2 authentication using Bitbucket provider';
      case KysoSettingsEnum.AUTH_GITHUB_CLIENT_ID:
        return 'Client ID used for OAUTH2 authentication using Github provider';
      case KysoSettingsEnum.AUTH_GITHUB_CLIENT_SECRET:
        return 'Secret used for OAUTH2 authentication using Github provider';
      case KysoSettingsEnum.AUTH_GOOGLE_CLIENT_ID:
        return 'Client ID used for OAUTH2 authentication using Google provider';
      case KysoSettingsEnum.AUTH_GOOGLE_CLIENT_SECRET:
        return 'Secret used for OAUTH2 authentication using Google provider';
      case KysoSettingsEnum.AUTH_GITLAB_CLIENT_ID:
        return 'Client ID used for OAUTH2 authentication using Gitlab provider';
      case KysoSettingsEnum.AUTH_GITLAB_CLIENT_SECRET:
        return 'Secret used for OAUTH2 authentication using Gitlab provider';
      case KysoSettingsEnum.AUTH_GITLAB_REDIRECT_URI:
        return 'Redirect URI used for OAUTH2 authentication using Gitlab provider';
      case KysoSettingsEnum.AUTH_PINGID_SAML_SSO_URL:
        return 'Initiate Single Sign-On (SSO) URL';
      case KysoSettingsEnum.KYSO_FILES_CLOUDFRONT_URL:
        return 'https://d1kser01wv8mbw.cloudfront.net';
      case KysoSettingsEnum.BASE_URL:
        return "Public frontend url, needed to build a webhook with github. Needs to be a public URL as well, because Github don't allow you to make a webhook vs localhost for security reasons";
      case KysoSettingsEnum.MAIL_TRANSPORT:
        return 'SMTP mail transport using the following format: smtps://USER:PASSWORD@smtp.googlemail.com';
      case KysoSettingsEnum.MAIL_FROM:
        return `Sender name and email which will send emails in name of Kyso. i.e: "kyso" <noreply@kyso.io>`;
      case KysoSettingsEnum.FRONTEND_URL:
        return `Frontend URL`;
      case KysoSettingsEnum.SFTP_HOST:
        return `SFTP host`;
      case KysoSettingsEnum.SFTP_PORT:
        return `SFTP port`;
      case KysoSettingsEnum.SFTP_USERNAME:
        return `SFTP username`;
      case KysoSettingsEnum.SFTP_PASSWORD:
        return `SFTP password`;
      case KysoSettingsEnum.SFTP_PUBLIC_USERNAME:
        return `SFTP username for public content`;
      case KysoSettingsEnum.SFTP_PUBLIC_PASSWORD:
        return `SFTP password for public content`;
      case KysoSettingsEnum.SFTP_DESTINATION_FOLDER:
        return `SFTP destination folder`;
      case KysoSettingsEnum.STATIC_CONTENT_PREFIX:
        return `Static content prefix`;
      case KysoSettingsEnum.STATIC_CONTENT_PUBLIC_PREFIX:
        return `Static content prefix for public content`;
      case KysoSettingsEnum.ELASTICSEARCH_URL:
        return `Internal Kubernetes URL for Elasticsearch`;
      case KysoSettingsEnum.DURATION_HOURS_JWT_TOKEN:
        return `Duration in hours for jwt token`;
      case KysoSettingsEnum.DURATION_HOURS_TOKEN_EMAIL_VERIFICATION:
        return `Duration in hours for token email verification`;
      case KysoSettingsEnum.HCAPTCHA_ENABLED:
        return `Enables hCaptcha globally in the platform`;
      case KysoSettingsEnum.DURATION_MINUTES_TOKEN_RECOVERY_PASSWORD:
        return `Duration in minutes for token recovery password`;
      case KysoSettingsEnum.HCAPTCHA_SITE_KEY:
        return `hCaptcha site key`;
      case KysoSettingsEnum.HCAPTCHA_SECRET_KEY:
        return `hCaptcha secret key`;
      case KysoSettingsEnum.SERVICE_DESK_EMAIL:
        return `Service desk email`;
      case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_GOOGLE:
        return 'Enables globally the authorization using google provider. Setti//ngs this to false makes the button "Sign in with Google" to dissapear';
      case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_GITLAB:
        return 'Enables globally the authorization using gitlab provider. Settings this to false makes the button "Sign in with Gitlab" to dissapear';
      case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_BITBUCKET:
        return 'Enables globally the authorization using bitbucket provider. Settings this to false makes the button "Sign in with Bitbucket" to dissapear';
      case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_KYSO:
        return 'Enables globally the authorization using kyso provider. Settings this to false makes the Kyso login form to dissapear';
      case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_GITHUB:
        return 'Enables globally the authorization using github provider. Settings this to false makes the button "Sign in with Github" to dissapear';
      case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_PINGID_SAML:
        return 'Enables globally the authorization using PingID SAML provider. Settings this to false makes the button "Sign in with PingID" to dissapear';
      case KysoSettingsEnum.KYSO_INDEXER_API_BASE_URL:
        return 'Base URL of the kyso indexing service';
      case KysoSettingsEnum.UNAUTHORIZED_REDIRECT_URL:
        return 'Redirection URL to which an unauthorized user is redirected';
      case KysoSettingsEnum.ADD_NEW_USERS_AUTOMATICALLY_TO_ORG:
        return 'If empty, has no effect. If has a value, adds any new user in the platform to the organizations set in this property (comma separated) with TEAM_READER role';
      case KysoSettingsEnum.MAX_FILE_SIZE:
        return 'Maximum upload file size';
      case KysoSettingsEnum.MAX_ORGANIZATIONS_PER_USER:
        return 'Maximum number of organizations a user can create';
      case KysoSettingsEnum.MAX_TEAMS_PER_USER:
        return 'Maximum number of teams in an organization that a user can create';
      case KysoSettingsEnum.KYSO_WEBHOOK_URL:
        return 'Webhooks URL (s3 import, du, etc.)';
      case KysoSettingsEnum.DEFAULT_REDIRECT_ORGANIZATION:
        return 'Default organization to redirect a non authenticated user';
      case KysoSettingsEnum.THEME:
        return 'Theme of the platform';
      case KysoSettingsEnum.ENABLE_INVITATION_LINKS_GLOBALLY:
        return 'If true, enables the invitation links for all organizations';
      case KysoSettingsEnum.GLOBAL_PRIVACY_SHOW_EMAIL:
        return 'If true, shows the email of the user globally in the application';
      default:
        return 'No description provided';
    }
  }
}
