import { InlineCommentStatusEnum, KysoSetting, KysoSettingsEnum, UpdateKysoSettingDto } from '@kyso-io/kyso-model';
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

  public static getKysoSettingDefaultValue(setting: KysoSettingsEnum): any {
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
        return 'smtps://mailu.kyso.io';
      case KysoSettingsEnum.MAIL_PORT:
        return 25;
      case KysoSettingsEnum.MAIL_FROM:
        return '"kyso" <dev@dev.kyso.io>';
      case KysoSettingsEnum.MAIL_USER:
        return 'dev@dev.kyso.io';
      case KysoSettingsEnum.MAIL_PASSWORD:
        return 'sphere6wrap&toxic';
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
      case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_OKTA_SAML:
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
      case KysoSettingsEnum.KYSO_NBDIME_URL:
        return 'http://kyso-nbdime';
      case KysoSettingsEnum.ALLOW_PUBLIC_CHANNELS:
        return 'true';
      case KysoSettingsEnum.ONBOARDING_MESSAGES:
        return {
          welcome_message: 'A place to publish, organise & discover presentation-ready research: Jupyter notebooks, HTML, Office files, SVS images, Markdown, Data Apps & much, much more!',
          demo_url: 'https://www.loom.com/embed/fa23c122402243539909f038ddef590b',
          first_cta: {
            title: 'Publish your work.',
            text: 'Upload existing research - no matter the format - to be indexed & shared with colleagues.',
            url: '/${user}/create-report-form',
          },
          second_cta: {
            title: 'Read a report.',
            text: 'Read through a report, interact with & comment on the results.',
            url: '/kyso-examples/general/kyso-report-examples/',
          },
          third_cta: {
            title: 'Search & discover.',
            text: 'Find the research you’re interested in from colleagues across the organisation.',
            url: '/search/?q=examples',
          },
          dropdown: {
            title: 'Welcome on board!',
            text: 'Here is your Onboard checklist',
            step_1: {
              title: 'Publish your work.',
              description: 'Upload existing research - no matter the format - to be indexed & shared with colleagues.',
              text: 'This is where you can upload existing files you might have ready to share. Post PowerPoints, notebooks, Word Docs, images & more. Make sure to upload to the correct channel and add tags to make it easier to find later.',
              demoUrl: 'https://www.loom.com/embed/55bcdb4f02f74b6590e39eae2ebb1af8',
              demoPreview: '/static/demo.png',
              cta: ' Publish my research now!',
              ctaUrl: '/${user}/create-report-form',
              docCta: 'What else can I publish?',
              docUrl: 'https://docs.kyso.io/kysos-renderer',
            },
            step_2: {
              title: 'Read a report.',
              description: 'Read through a report, interact with & comment on results. ',
              text: 'This is an example Jupyter notebook rendered for presentation on Kyso. You can browse through files & previous versions, reveal code, interact with your colleague’s insights and make comments like you would on Google Docs.',
              demoUrl: 'https://www.loom.com/embed/db8ef30de06b4b6392bd8898cdb03f71',
              demoPreview: '/static/read.png',
              cta: ' Discover other reports to read!',
              ctaUrl: 'https://kyso.io/search/?q=',
              docUrl: '',
              docCta: '',
            },
            step_3: {
              title: 'Search & discover.',
              description: 'Find research you’re interested in from colleagues across the organisation.',
              text: 'Content published to Kyso is categorised across different Organisations, Channels and Tags, and is indexed full-text so you can be very specific when searching for research you are interested in.',
              demoUrl: 'https://www.loom.com/embed/d408c2bf05f14e1db051f85f2efcb6f5',
              demoPreview: '/static/demo.png',
              cta: 'Discover other reports to read!',
              ctaUrl: 'https://kyso.io/search/?q=',
              docUrl: '',
              docCta: '',
            },
            step_4: {
              title: 'View my profile.',
              description: 'See how your work is displayed for others to discover and learn from.',
              text: 'This is the page your colleagues will see when they click on your Kyso avatar to discover & learn from your work. Be sure to keep your reports up to date. ',
              demoUrl: 'https://www.loom.com/embed/56350d3e51bb4d21a312caf94282110f',
              demoPreview: '/static/profile.png',
              cta: ' Publish my research now!',
              ctaUrl: 'https://kyso.io/kyso-examples/create-report-form/',
              docCta: ' How do access controls work on Kyso?',
              docUrl: 'https://docs.kyso.io/settings-and-administration/managing-access',
            },
            step_5: {
              title: 'Install & integrate Kyso into your workflows.',
              description: 'Download & install the Kyso CLI tool so you can publish (many) results automatically from within your technical workflows: git, s3, Domino & more!',
              text: 'Install the Kyso CLI tool so you can integrate the publishing process into your data science workflows, whether that means pushing models from MLOps platforms like Domino or leveraging Git actions to maintain version control across the team.',
              demoUrl: 'https://www.loom.com/embed/5e67af40d0c948f4b3bdeb5b29b4c3a0',
              demoPreview: '/static/cli.png',
              cta: 'Install the Kyso CLI now! ',
              ctaUrl: 'https://docs.kyso.io/posting-to-kyso/kyso-command-line-tool',
              docCta: 'How to create an access token?',
              docUrl: 'https://dev.kyso.io/kyleos/docs/getting-started-with-kyso/kyso-cli.md',
            },
          },
        };
      case KysoSettingsEnum.FOOTER_CONTENTS:
        return [
          { text: 'Documentation', url: 'https://docs.kyso.io/' },
          { text: 'About', url: 'https://about.kyso.io/about' },
          { text: 'Prices', url: 'https://about.kyso.io/pricing' },
          { text: 'Privacy', url: 'https://about.kyso.io/privacy' },
        ];
      case KysoSettingsEnum.KYSO_COMMENT_STATES_VALUES:
        return {
          labels: {
            [InlineCommentStatusEnum.OPEN]: 'open',
            [InlineCommentStatusEnum.TO_DO]: 'todo',
            [InlineCommentStatusEnum.DOING]: 'doing',
            [InlineCommentStatusEnum.CLOSED]: 'closed',
          },
          classes: {
            [InlineCommentStatusEnum.OPEN]: 'bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300',
            [InlineCommentStatusEnum.TO_DO]: 'bg-gray-100 text-gray-800 text-xs font-medium px-2 py-0.5 rounded-full dark:bg-gray-700 dark:text-gray-300',
            [InlineCommentStatusEnum.DOING]: 'bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded-full dark:bg-yellow-900 dark:text-yellow-300',
            [InlineCommentStatusEnum.CLOSED]: 'bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full dark:bg-red-900 dark:text-red-300',
          },
        };
      case KysoSettingsEnum.MAX_NUMBER_HARDLINKS:
        return 150;
      case KysoSettingsEnum.SFTP_PORT:
        return 22;
      case KysoSettingsEnum.SFTP_USERNAME:
        return 'scs';
      case KysoSettingsEnum.SFTP_PUBLIC_USERNAME:
        return 'pub';
      case KysoSettingsEnum.STATIC_CONTENT_PREFIX:
        return '/scs';
      case KysoSettingsEnum.STATIC_CONTENT_PUBLIC_PREFIX:
        return '/pub';
      case KysoSettingsEnum.REPORT_PATH:
        return '/data';
      case KysoSettingsEnum.TMP_FOLDER_PATH:
        return '/app/data';
      case KysoSettingsEnum.ONLY_GLOBAL_ADMINS_CAN_CREATE_ORGANIZATIONS:
        return false;
      case KysoSettingsEnum.OKTA_SAML_USER_MAPPING:
        return {
          avatar_url: [],
          username: [],
          email: ['NameID'],
          name: ['firstName', 'lastName'],
          display_name: ['firstName'],
          bio: [],
          link: [],
          location: [],
        };
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
      case KysoSettingsEnum.AUTH_OKTA_SAML_SSO_URL:
        return 'Initiate Single Sign-On (SSO) URL';
      case KysoSettingsEnum.KYSO_FILES_CLOUDFRONT_URL:
        return 'https://d1kser01wv8mbw.cloudfront.net';
      case KysoSettingsEnum.BASE_URL:
        return "Public frontend url, needed to build a webhook with github. Needs to be a public URL as well, because Github don't allow you to make a webhook vs localhost for security reasons";
      case KysoSettingsEnum.MAIL_TRANSPORT:
        return 'SMTP mail transport using the following format: smtps://USER:PASSWORD@smtp.googlemail.com';
      case KysoSettingsEnum.MAIL_FROM:
        return `Sender name and email which will send emails in name of Kyso. i.e: "kyso" <noreply@kyso.io>`;
      case KysoSettingsEnum.MAIL_USER:
        return 'SMTP username';
      case KysoSettingsEnum.MAIL_PASSWORD:
        return 'SMTP password';
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
      case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_OKTA_SAML:
        return 'Enables globally the authorization using Okta SAML provider. Settings this to false makes the button "Sign in with Okta" to dissapear';
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
      case KysoSettingsEnum.KYSO_NBDIME_URL:
        return 'URL of the nbdime service';
      case KysoSettingsEnum.ALLOW_PUBLIC_CHANNELS:
        return 'If true, allows public channels';
      case KysoSettingsEnum.ONBOARDING_MESSAGES:
        return 'Text shown up in the onboarding process';
      case KysoSettingsEnum.FOOTER_CONTENTS:
        return 'Contents that will be shown in the footer';
      case KysoSettingsEnum.KYSO_COMMENT_STATES_VALUES:
        return 'Values of css classes for the inline comment states';
      case KysoSettingsEnum.MAX_NUMBER_HARDLINKS:
        return 'Maximum number of hardlinks that a file can carry on';
      case KysoSettingsEnum.ONLY_GLOBAL_ADMINS_CAN_CREATE_ORGANIZATIONS:
        return 'If true, only global admins can create organizations';
      default:
        return 'No description provided';
    }
  }
}
