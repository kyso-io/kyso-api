import {
  Comment,
  CreateDiscussionRequestDTO,
  CreateReportDTO,
  CreateUserRequestDTO,
  Discussion,
  EntityEnum,
  GlobalPermissionsEnum,
  KysoRole,
  Login,
  LoginProviderEnum,
  Organization,
  Report,
  ReportPermissionsEnum,
  RepositoryProvider,
  Tag,
  TagRequestDTO,
  Team,
  TeamPermissionsEnum,
  TeamVisibilityEnum,
  Token,
  User,
  UserAccount,
} from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import * as moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { Autowired } from '../../decorators/autowired';
import { PlatformRole } from '../../security/platform-roles';
import { AuthService } from '../auth/auth.service';
import { CommentsService } from '../comments/comments.service';
import { DiscussionsService } from '../discussions/discussions.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ReportsService } from '../reports/reports.service';
import { TagsService } from '../tags/tags.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { exec } = require('child_process');

const mailPrefix = process.env.POPULATE_TEST_DATA_MAIL_PREFIX ? process.env.POPULATE_TEST_DATA_MAIL_PREFIX : 'lo';
@Injectable()
export class TestingDataPopulatorService {
  private Rey_TeamAdminUser: User;
  private Kylo_TeamContributorUser: User;
  private Chewbacca_TeamReaderUser: User;
  private Gideon_OrganizationAdminUser: User;
  private Palpatine_PlatformAdminUser: User;
  private BabyYoda_OrganizationAdminUser: User;
  private Ahsoka_ExternalUser: User;
  private Dooku_WithoutOrg: User;
  private Leia_OrgAdmin: User;

  private BabyYoda_Token: Token;
  private Gideon_Token: Token;
  private Palpatine_Token: Token;

  private DarksideOrganization: Organization;
  private LightsideOrganization: Organization;

  private KyloThoughtsReport: Report;
  private DeathStarEngineeringReport: Report;
  private RebelScumCounterAttackReport: Report;
  private BestPokemonReport: Report;

  private TestComment: Comment;
  private TestChildComment1: Comment;
  private TestChildComment2: Comment;
  private CustomTeamRole: KysoRole;
  private CustomOrganizationRole: KysoRole;

  private PublicTeam: Team;
  private ProtectedTeamWithCustomRole: Team;
  private PrivateTeam: Team;

  private KylorenTag: Tag;
  private AngerTag: Tag;
  private DoubtsTag: Tag;
  private PokemonTag: Tag;
  private PikachuTag: Tag;
  private SecretTag: Tag;
  private DeathTag: Tag;
  private ImperiumTag: Tag;
  private DeathStarTag: Tag;
  private FreedomTag: Tag;
  private JediTag: Tag;

  // API Gherkin Test Data
  private APITests_Organization: Organization;
  private APITests_PublicChannel: Team;
  private APITests_ProtectedChannel: Team;
  private APITests_PrivateChannel: Team;

  @Autowired({ typeName: 'CommentsService' })
  private commentsService: CommentsService;

  @Autowired({ typeName: 'UsersService' })
  private usersService: UsersService;

  @Autowired({ typeName: 'OrganizationsService' })
  private organizationsService: OrganizationsService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  @Autowired({ typeName: 'ReportsService' })
  private reportsService: ReportsService;

  @Autowired({ typeName: 'DiscussionsService' })
  private discussionsService: DiscussionsService;

  @Autowired({ typeName: 'TagsService' })
  private tagsService: TagsService;

  @Autowired({ typeName: 'AuthService' })
  private authService: AuthService;

  public async populateTestData() {
    if (process.env.POPULATE_TEST_DATA && process.env.POPULATE_TEST_DATA === 'true') {
      Logger.log(`
                  ^     ^
                   ^   ^
                   (o o)
                  {  |  }  Testing data populator will create testing data in your database
                     "
            `);

      if (await this.checkIfAlreadyExists()) {
        Logger.log(`
                  THE TEST DATA ALREADY EXISTS. SKIPPING.
                `);
        return;
      }

      await this.createTestingUsers();
      await this.createAccessTokens();
      await this.createOrganizations();
      await this.createTeams();
      await this.assignUsersToOrganizations();
      await this.assignUsersToTeams();
      await this._updateUserAccounts();

      await this.createTestingReports();
      await this.createTestingComments();
      await this.createDiscussions();
      await this.createTags();
      await this.assignTagsToReports();
    }
  }

  private async checkIfAlreadyExists() {
    // I assume only these two usernames exist if they were created by the test data populator
    const testUsersByUsername = await this.usersService.getUsers({
      filter: { $or: [{ email: `${mailPrefix}+rey@dev.kyso.io` }, { email: `${mailPrefix}+kylo@dev.kyso.io` }] },
    });
    if (testUsersByUsername.length === 2) {
      return true;
    }
    return false;
  }

  private async createTestingUsers() {
    try {
      const rey_TestTeamAdminUser: CreateUserRequestDTO = new CreateUserRequestDTO(
        `${mailPrefix}+rey@dev.kyso.io`,
        'skywalker',
        'Rey Skywalker',
        'Rey',
        LoginProviderEnum.KYSO,
        '[Team Admin] Rey is a Team Admin',
        '',
        '',
        'free',
        'https://bit.ly/3okf2mg',
        null,
        true,
        [],
        'n0tiene',
      );

      const kylo_TestTeamContributorUser: CreateUserRequestDTO = new CreateUserRequestDTO(
        `${mailPrefix}+kylo@dev.kyso.io`,
        'kyloren',
        'Ben Solo',
        'Kylo Ren',
        LoginProviderEnum.KYSO,
        '[Team Contributor] Kylo Ren is a Team Contributor',
        '',
        '',
        'free',
        'https://bit.ly/3qfdNVo',
        null,
        true,
        [],
        'n0tiene',
      );

      const chewbacca_TestTeamReaderUser: CreateUserRequestDTO = new CreateUserRequestDTO(
        `${mailPrefix}+chewbacca@dev.kyso.io`,
        'chewie',
        'GRWAAAAAAWWLLL Chewbacca',
        'Chewbacca',
        LoginProviderEnum.KYSO,
        '[Team Reader] Chewbacca is a Team Reader',
        '',
        '',
        'free',
        'https://bit.ly/3slTUyI',
        null,
        true,
        [],
        'n0tiene',
      );

      const gideon_TestOrganizationAdminUser: CreateUserRequestDTO = new CreateUserRequestDTO(
        `${mailPrefix}+gideon@dev.kyso.io`,
        'gideon',
        'The Greatest Moff Giddeon',
        'Moff Gideon',
        LoginProviderEnum.KYSO,
        '[Organization Admin] Moff Gideon is an Organization Admin',
        '',
        '',
        'free',
        'https://bit.ly/3EWyNG6',
        null,
        true,
        [],
        'n0tiene',
      );

      const palpatine_TestPlatformAdminUser: CreateUserRequestDTO = new CreateUserRequestDTO(
        `${mailPrefix}+palpatine@dev.kyso.io`,
        `palpatine`,
        'Lord Palpatine',
        'palpatine',
        LoginProviderEnum.KYSO,
        '[Platform Admin] Palpatine is a platform admin',
        '',
        '',
        'free',
        'https://bit.ly/3IXAFki',
        null,
        true,
        [GlobalPermissionsEnum.GLOBAL_ADMIN],
        'n0tiene',
      );

      const babyYoda_TestOrganizationAdminUser: CreateUserRequestDTO = new CreateUserRequestDTO(
        `${mailPrefix}+baby_yoda@dev.kyso.io`,
        'the-real-baby-yoda',
        'Grogu aka Baby Yoda',
        'Baby Yoda',
        LoginProviderEnum.KYSO,
        '[Organization Admin] Baby Yoda is an Organization Admin',
        '',
        '',
        'free',
        'https://bit.ly/34q5SxQ',
        null,
        true,
        [],
        'n0tiene',
      );

      const ahsoka_ExternalUser: CreateUserRequestDTO = new CreateUserRequestDTO(
        `${mailPrefix}+ahsoka@dev.kyso.io`,
        'ahsoka',
        'Ahsoka Tano',
        'Ahsoka Tano',
        LoginProviderEnum.KYSO,
        '[External] Ahsoka is a External user',
        '',
        '',
        'free',
        'https://bit.ly/3FeZCZO',
        null,
        true,
        [],
        'n0tiene',
      );

      const dooku_WithoutOrg: CreateUserRequestDTO = new CreateUserRequestDTO(
        `${mailPrefix}+dooku@dev.kyso.io`,
        'dooku',
        'Count Dooku',
        'Count Dooku',
        LoginProviderEnum.KYSO,
        '[Contributor] Count Dooku is a Contributor',
        '',
        '',
        'free',
        'https://bit.ly/3W4adfX',
        null,
        true,
        [],
        'n0tiene',
      );

      const leia_OrgAdmin: CreateUserRequestDTO = new CreateUserRequestDTO(
        `${mailPrefix}+leia@dev.kyso.io`,
        'leia',
        'Leia Organa',
        'Leia Organa',
        LoginProviderEnum.KYSO,
        '[Org Admin] Leia Organa is org admin',
        '',
        '',
        'free',
        'https://bit.ly/3DxTfzj',
        null,
        true,
        [],
        'n0tiene',
      );

      this.Rey_TeamAdminUser = await this._createUser(rey_TestTeamAdminUser);
      this.Kylo_TeamContributorUser = await this._createUser(kylo_TestTeamContributorUser);
      this.Chewbacca_TeamReaderUser = await this._createUser(chewbacca_TestTeamReaderUser);
      this.Gideon_OrganizationAdminUser = await this._createUser(gideon_TestOrganizationAdminUser);
      this.BabyYoda_OrganizationAdminUser = await this._createUser(babyYoda_TestOrganizationAdminUser);
      this.Palpatine_PlatformAdminUser = await this._createUser(palpatine_TestPlatformAdminUser);
      this.Ahsoka_ExternalUser = await this._createUser(ahsoka_ExternalUser);
      this.Dooku_WithoutOrg = await this._createUser(dooku_WithoutOrg);
      this.Leia_OrgAdmin = await this._createUser(leia_OrgAdmin);

      await this.usersService.updateUser(
        { id: this.Rey_TeamAdminUser.id },
        {
          $set: {
            email_verified: true,
            show_captcha: false,
            avatar_url: rey_TestTeamAdminUser.avatar_url,
            global_permissions: rey_TestTeamAdminUser.global_permissions,
          },
        },
      );
      await this.usersService.updateUser(
        { id: this.Kylo_TeamContributorUser.id },
        {
          $set: {
            email_verified: true,
            show_captcha: false,
            avatar_url: kylo_TestTeamContributorUser.avatar_url,
            global_permissions: kylo_TestTeamContributorUser.global_permissions,
          },
        },
      );
      await this.usersService.updateUser(
        { id: this.Chewbacca_TeamReaderUser.id },
        {
          $set: {
            email_verified: true,
            show_captcha: false,
            avatar_url: chewbacca_TestTeamReaderUser.avatar_url,
            global_permissions: chewbacca_TestTeamReaderUser.global_permissions,
          },
        },
      );
      await this.usersService.updateUser(
        { id: this.Gideon_OrganizationAdminUser.id },
        {
          $set: {
            email_verified: true,
            show_captcha: false,
            avatar_url: gideon_TestOrganizationAdminUser.avatar_url,
            global_permissions: gideon_TestOrganizationAdminUser.global_permissions,
          },
        },
      );
      await this.usersService.updateUser(
        { id: this.BabyYoda_OrganizationAdminUser.id },
        {
          $set: {
            email_verified: true,
            show_captcha: false,
            avatar_url: palpatine_TestPlatformAdminUser.avatar_url,
            global_permissions: palpatine_TestPlatformAdminUser.global_permissions,
          },
        },
      );
      await this.usersService.updateUser(
        { id: this.Palpatine_PlatformAdminUser.id },
        {
          $set: {
            email_verified: true,
            show_captcha: false,
            avatar_url: babyYoda_TestOrganizationAdminUser.avatar_url,
            global_permissions: babyYoda_TestOrganizationAdminUser.global_permissions,
          },
        },
      );

      await this.usersService.updateUser(
        { id: this.Ahsoka_ExternalUser.id },
        {
          $set: {
            email_verified: true,
            show_captcha: false,
            avatar_url: ahsoka_ExternalUser.avatar_url,
            global_permissions: ahsoka_ExternalUser.global_permissions,
          },
        },
      );

      await this.usersService.updateUser(
        { id: this.Dooku_WithoutOrg.id },
        {
          $set: {
            email_verified: false,
            show_captcha: true,
            avatar_url: dooku_WithoutOrg.avatar_url,
            global_permissions: dooku_WithoutOrg.global_permissions,
          },
        },
      );

      await this.usersService.updateUser(
        { id: this.Leia_OrgAdmin.id },
        {
          $set: {
            email_verified: true,
            show_captcha: false,
            avatar_url: leia_OrgAdmin.avatar_url,
            global_permissions: leia_OrgAdmin.global_permissions,
          },
        },
      );

      // Get the login Tokens for BabyYoda and Gideon
      const babyYodaToken: string = await this.authService.login(new Login('n0tiene', LoginProviderEnum.KYSO, `${mailPrefix}+baby_yoda@dev.kyso.io`, null));

      this.BabyYoda_Token = await this.authService.evaluateAndDecodeToken(babyYodaToken);

      const gideonToken: string = await this.authService.login(new Login('n0tiene', LoginProviderEnum.KYSO, `${mailPrefix}+gideon@dev.kyso.io`, null));

      this.Gideon_Token = await this.authService.evaluateAndDecodeToken(gideonToken);

      const palpatineToken: string = await this.authService.login(new Login('n0tiene', LoginProviderEnum.KYSO, `${mailPrefix}+palpatine@dev.kyso.io`, null));

      this.Palpatine_Token = await this.authService.evaluateAndDecodeToken(palpatineToken);
    } catch (ex) {
      Logger.error('Error at createTestingUsers', ex);
    }
  }

  private async createAccessTokens(): Promise<void> {
    try {
      const accessTokenUuid = 'abcdef123456';
      await this.usersService.createKysoAccessToken(this.Rey_TeamAdminUser.id, 'test-access-token', [], moment().add(100, 'years').toDate(), accessTokenUuid);
    } catch (ex) {
      Logger.error('Error at createAccessTokens', ex);
    }
  }

  private async _updateUserAccounts() {
    try {
      const githubUserAccount: UserAccount = new UserAccount();
      githubUserAccount.accessToken = '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';
      githubUserAccount.accountId = '98749909';
      githubUserAccount.payload = {};
      githubUserAccount.type = LoginProviderEnum.GITHUB;
      githubUserAccount.username = 'mozartmae';

      await this.usersService.addAccount(this.Rey_TeamAdminUser.id, githubUserAccount);
      await this.usersService.addAccount(this.Kylo_TeamContributorUser.id, githubUserAccount);
      await this.usersService.addAccount(this.Chewbacca_TeamReaderUser.id, githubUserAccount);
      await this.usersService.addAccount(this.Gideon_OrganizationAdminUser.id, githubUserAccount);
      await this.usersService.addAccount(this.BabyYoda_OrganizationAdminUser.id, githubUserAccount);
      await this.usersService.addAccount(this.Palpatine_PlatformAdminUser.id, githubUserAccount);
    } catch (ex) {
      Logger.error('Error at _updateUserAccounts', ex);
    }
  }

  private async _createUser(user: CreateUserRequestDTO) {
    try {
      Logger.log(`Creating ${user.display_name} user...`);
      return await this.usersService.createUser(user);
    } catch (ex) {
      Logger.log(`${user.display_name} user already exists`);
      return this.usersService.getUser({ filter: { username: user.username } });
    }
  }

  private async createTestingReports() {
    try {
      const reportKylosThoughts = new CreateReportDTO(
        'kylos-thoughts',
        'fran-kyso',
        RepositoryProvider.KYSO,
        'main',
        '.',
        this.ProtectedTeamWithCustomRole.id,
        `Kylo's thoughts about to switch from darkside to lightside`,
        'Sometimes the anger flows through me and I want to be at the darkside. But on the other hand, when I see Rey I get doubts and want to be in the lightside!',
        null,
        null,
      );

      this.KyloThoughtsReport = await this._createReport(this.Kylo_TeamContributorUser, reportKylosThoughts);

      const reportMoffGideonPokemonReport = new CreateReportDTO(
        'best-pokemon-ever',
        'fran-kyso',
        RepositoryProvider.KYSO,
        'main',
        '.',
        this.PrivateTeam.id,
        `The Best Pokemon Report by Moff Gideon`,
        `Do you think Pokemon is not suitable for Lord Siths? You're wrong! See my report to know who is the best pokemon ever!`,
        null,
        null,
      );

      this.BestPokemonReport = await this._createReport(this.Kylo_TeamContributorUser, reportMoffGideonPokemonReport);

      const reportDeathStarEngineering = new CreateReportDTO(
        'death-star-engineering',
        'fran-kyso',
        RepositoryProvider.KYSO,
        'main',
        'kronig-penney-exploration',
        this.PublicTeam.id,
        `Engineering details about the construction of the Dark Star for the Imperium`,
        'Make sure that this details dont get leaked as the lightside can really fuck us with that information',
        null,
        null,
      );

      this.DeathStarEngineeringReport = await this._createReport(this.Gideon_OrganizationAdminUser, reportDeathStarEngineering);

      const reportRebelScumCounterAttack = new CreateReportDTO(
        'rebel-scum-counterattack',
        'fran-kyso',
        RepositoryProvider.KYSO,
        'main',
        'kronig-penney-exploration',
        this.ProtectedTeamWithCustomRole.id,
        `Counterattack plan's to destroy Death Star`,
        `Using the information that Moff Gideon leaked absurdly, in this report we detail how we're going to destroy the Empire`,
        null,
        null,
      );

      this.RebelScumCounterAttackReport = await this._createReport(this.Rey_TeamAdminUser, reportRebelScumCounterAttack);

      // Create reports using kyso-cli
      // Check that kyso-cli is available
      console.log(
        `
                _  __    _  _                             ___     _       ___   
                | |/ /   | || |   ___     ___      o O O  / __|   | |     |_ _|  
                | ' <     \\_, |  (_-<    / _ \\    o      | (__    | |__    | |   
                |_|\\_\\   _|__/   /__/_   \\___/   TS__[O]  \\___|   |____|  |___|  
            _|"""""|_| """"|_|"""""|_|"""""| {======|_|"""""|_|"""""|_|"""""| 
            "\`-0-0-'"\`-0-0-'"\`-0-0-'"\`-0-0-'./o--000'"\`-0-0-'"\`-0-0-'"\`-0-0-' 
                
                Checking that Kyso-CLI is installed in this local machine
            `,
      );

      exec('kyso', (err, stdout, stderr) => {
        if (!err) {
          Logger.log('Kyso CLI is available in this machine... logging as user palpatine');

          // LOGIN vs this server
          exec(`kyso login --username lo+palpatine@dev.kyso.io --password n0tiene --provider kyso --kysoInstallUrl http://localhost:${process.env.PORT}`, (err, stdout, stderr) => {
            Logger.log(stdout);

            if (!err) {
              // Create new Kronig-Penney report
              exec(`kyso push -p ./test-reports/kronig-penney-exploration`, (err, stdout, stderr) => {
                Logger.log('Creating Kronig-Penney report');
                Logger.log(stdout);

                if (!err) {
                  Logger.log('Uploaded kronig-penney-exploration');
                } else {
                  Logger.error('Push of Kronig-Penney report failed');
                }
              });

              // Create new MultiQ report
              exec(`kyso push -p ./test-reports/multiq-report`, (err, stdout, stderr) => {
                Logger.log('Creating MultiQ report');
                Logger.log(stdout);

                if (!err) {
                  Logger.log('Uploaded MultiQ');

                  // Create a new version of MultiQ report
                  exec(`kyso push -p ./test-reports/multiq-report`, (err, stdout, stderr) => {
                    Logger.log('Creating a new version of MultiQ report');
                    Logger.log(stdout);

                    if (!err) {
                      Logger.log('Uploaded new version of MultiQ report');
                    } else {
                      Logger.error('Push of new version of MultiQ report failed');
                    }
                  });
                } else {
                  Logger.error('Push of MultiQ report failed');
                }
              });

              // Create new Markdown report
              exec(`kyso push -p ./test-reports/markdown-report`, (err, stdout, stderr) => {
                Logger.log('Creating Markdown report');
                Logger.log(stdout);

                if (!err) {
                  Logger.log('Uploaded Markdown');
                } else {
                  Logger.error('Push of Markdown report failed');
                }
              });

              // Import a report from Github using kyso-cli
              exec(`kyso import-github-repository --name jupyter-samples`, (err, stdout, stderr) => {
                Logger.log('Importing jupyter-samples report from Github using kyso-cli');
                Logger.log(stdout);

                if (!err) {
                  Logger.log('Uploaded jupyter-samples');
                } else {
                  Logger.error('Push of jupyter-samples report failed');
                }
              });

              // Import a report from Github using kyso-cli
              exec(`kyso import-github-repository --name Kalman-and-Bayesian-Filters-in-Python`, (err, stdout, stderr) => {
                Logger.log('Importing Kalman-and-Bayesian-Filters-in-Python report from Github using kyso-cli');
                Logger.log(stdout);

                if (!err) {
                  Logger.log('Uploaded Kalman-and-Bayesian-Filters-in-Python');
                } else {
                  Logger.error('Push of Kalman-and-Bayesian-Filters-in-Python report failed');
                }
              });

              // Import a report from Github using kyso-cli
              exec(`kyso import-github-repository --name notebook-examples`, (err, stdout, stderr) => {
                Logger.log('Importing notebook-examples report from Github using kyso-cli');
                Logger.log(stdout);

                if (!err) {
                  Logger.log('Uploaded notebook-examples');
                } else {
                  Logger.error('Push of notebook-examples report failed');
                }
              });
            } else {
              Logger.error("Can't login as Palpatine. Testing reports based on CLI will not be created.");
            }
          });
        } else {
          Logger.error('Kyso CLI is not installed in this machine. Testing reports based on CLI will not be created');
          Logger.log(
            `Installation instructions:
                        sudo npm install -g kyso
                    
                    To populate these reports without deleting the entire database, please execute populate-reports-by-kyso-cli.sh script
                    `,
          );
        }
      });
    } catch (ex) {
      Logger.error('Error at createTestingReports', ex);
    }
  }

  private async _createReport(user: User, report: CreateReportDTO) {
    try {
      Logger.log(`Creating ${report.name} report...`);
      return this.reportsService.createReport(user.id, report);
    } catch (ex) {
      Logger.log(`${report.name} report already exists`);
    }
  }

  private async createTestingComments() {
    try {
      const testComment = new Comment('Best pokemon is Charmander', 'Best pokemon is Charmander', this.Rey_TeamAdminUser.id, this.BestPokemonReport.id, null, null, []);
      this.TestComment = await this._createComment(testComment);
      this.TestChildComment1 = await this._createComment(
        new Comment('Are you mad? Obviously Pikachu', 'Are you mad? Obviously Pikachu', this.Gideon_OrganizationAdminUser.id, this.BestPokemonReport.id, null, this.TestComment.id, []),
      );
      this.TestChildComment2 = await this._createComment(
        new Comment('WTF Gideon, you deserve to be arrested', 'WTF Gideon, you deserve to be arrested', this.Rey_TeamAdminUser.id, this.BestPokemonReport.id, null, this.TestComment.id, []),
      );
    } catch (ex) {
      Logger.error('Error at createTestingComments', ex);
    }
  }

  private async _createComment(comment: Comment): Promise<Comment> {
    try {
      Logger.log(`Creating ${comment.text} comment...`);
      return this.commentsService.createComment(comment);
    } catch (ex) {
      Logger.log(`"${comment.text}" comment already exists`);
    }
  }

  private async createOrganizations() {
    try {
      const darksideOrganization: Organization = new Organization(
        'darkside',
        'Darkside Ltd.',
        [],
        [],
        'darkside@kyso.io',
        'random-stripe-id-with-no-use',
        'G891724',
        false,
        '',
        '',
        '',
        '',
        uuidv4(),
        null,
      );

      this.DarksideOrganization = await this._createOrganization(darksideOrganization);

      this.CustomOrganizationRole = new KysoRole('custom-organization-random-role', [TeamPermissionsEnum.CREATE, TeamPermissionsEnum.DELETE]);

      const lightsideOrganization: Organization = new Organization(
        'lightside',
        'The Lightside Inc.',
        [this.CustomOrganizationRole],
        [],
        'lightside@kyso.io',
        'another-random-stripe-id-with-no-use',
        'ES87961244T',
        false,
        '',
        '',
        '',
        '',
        uuidv4(),
        null,
      );

      this.LightsideOrganization = await this._createOrganization(lightsideOrganization);

      const apiTestOrganization: Organization = new Organization(
        'api-tests',
        'Organization to perform automatic API Tests using Gherkin',
        [],
        [],
        'lo+api-tests-organization@kyso.io',
        'another-random-stripe-id-with-no-use',
        'ES87961244T',
        true,
        '',
        '',
        '',
        '',
        uuidv4(),
        null,
      );

      this.APITests_Organization = await this._createOrganization(apiTestOrganization);
    } catch (ex) {
      Logger.error('Error at createOrganizations', ex);
    }
  }

  private async _createOrganization(organization: Organization) {
    try {
      Logger.log(`Creating ${organization.sluglified_name} organization...`);
      return await this.organizationsService.createOrganization(this.Palpatine_Token, organization);
    } catch (ex) {
      Logger.log(` ${organization.sluglified_name} organization already exists`);
    }
  }

  private async createTeams() {
    try {
      const publicTeam = new Team('Public Team', 'https://bit.ly/3J49GUO', 'A public team', '', 'Cleveland', [], this.DarksideOrganization.id, TeamVisibilityEnum.PUBLIC, null);

      this.CustomTeamRole = new KysoRole('custom-team-random-role', [ReportPermissionsEnum.READ]);

      const protectedTeam = new Team(
        'Protected TEAM',
        'https://bit.ly/3e9mDOZ',
        'A protected team with custom roles',
        '',
        'Sacramento',
        [this.CustomTeamRole],
        this.LightsideOrganization.id,
        TeamVisibilityEnum.PROTECTED,
        null,
      );

      const privateTeam = new Team('PRIVATE TeaM', 'https://bit.ly/3sr8x45', 'A private team', '', 'Milwaukee', [this.CustomTeamRole], this.DarksideOrganization.id, TeamVisibilityEnum.PRIVATE, null);

      this.PublicTeam = await this._createTeam(publicTeam);
      this.ProtectedTeamWithCustomRole = await this._createTeam(protectedTeam);
      this.PrivateTeam = await this._createTeam(privateTeam);

      // API Tests
      const apiTests_publicChannel = new Team('Public Channel', '', 'A Public Channel', '', 'Sacramento', [], this.APITests_Organization.id, TeamVisibilityEnum.PUBLIC, null);

      const apiTests_protectedChannel = new Team('Protected Channel', '', 'A Protected Channel', '', 'Sacramento', [], this.APITests_Organization.id, TeamVisibilityEnum.PROTECTED, null);

      const apiTests_privateChannel = new Team('Private Channel', '', 'A Private Channel', '', 'Sacramento', [], this.APITests_Organization.id, TeamVisibilityEnum.PRIVATE, null);

      this.APITests_PublicChannel = await this._createTeam(apiTests_publicChannel);
      this.APITests_ProtectedChannel = await this._createTeam(apiTests_protectedChannel);
      this.APITests_PrivateChannel = await this._createTeam(apiTests_privateChannel);
    } catch (ex) {
      Logger.error('Error at createTeams', ex);
    }
  }

  private async _createTeam(team: Team) {
    try {
      Logger.log(`Creating ${team.sluglified_name} team...`);
      return await this.teamsService.createTeam(this.Palpatine_Token, team);
    } catch (ex) {
      Logger.log(`${team.sluglified_name} team already exists`);
    }
  }

  private async assignUsersToOrganizations() {
    try {
      /*** Darkside organization ***/

      // Organization admin
      await this.organizationsService.addMembersById(this.DarksideOrganization.id, [this.Gideon_OrganizationAdminUser.id.toString()], [PlatformRole.ORGANIZATION_ADMIN_ROLE.name]);

      await this.organizationsService.addMembersById(this.DarksideOrganization.id, [this.Kylo_TeamContributorUser.id.toString()], [PlatformRole.TEAM_CONTRIBUTOR_ROLE.name]);

      /*** Lightside organization ***/
      await this.organizationsService.addMembersById(this.LightsideOrganization.id, [this.BabyYoda_OrganizationAdminUser.id.toString()], [PlatformRole.ORGANIZATION_ADMIN_ROLE.name]);

      await this.organizationsService.addMembersById(this.LightsideOrganization.id, [this.Rey_TeamAdminUser.id], [PlatformRole.TEAM_ADMIN_ROLE.name]);

      await this.organizationsService.addMembersById(this.LightsideOrganization.id, [this.Kylo_TeamContributorUser.id], [PlatformRole.TEAM_READER_ROLE.name]);

      await this.organizationsService.addMembersById(this.LightsideOrganization.id, [this.Chewbacca_TeamReaderUser.id.toString()], [PlatformRole.TEAM_READER_ROLE.name]);

      await this.organizationsService.addMembersById(this.LightsideOrganization.id, [this.Ahsoka_ExternalUser.id.toString()], [PlatformRole.EXTERNAL_ROLE.name]);

      /** api-tests organization */
      Logger.log(`Adding ${this.Chewbacca_TeamReaderUser.email} as ${PlatformRole.TEAM_READER_ROLE.name} to ${this.APITests_Organization.sluglified_name}`);
      await this.organizationsService.addMembersById(this.APITests_Organization.id, [this.Chewbacca_TeamReaderUser.id.toString()], [PlatformRole.TEAM_READER_ROLE.name]);

      Logger.log(`Adding ${this.Ahsoka_ExternalUser.email} as ${PlatformRole.TEAM_CONTRIBUTOR_ROLE.name} to ${this.APITests_Organization.sluglified_name}`);
      await this.organizationsService.addMembersById(this.APITests_Organization.id, [this.Ahsoka_ExternalUser.id.toString()], [PlatformRole.TEAM_CONTRIBUTOR_ROLE.name]);

      Logger.log(`Adding ${this.Rey_TeamAdminUser.email} as ${PlatformRole.TEAM_ADMIN_ROLE.name} to ${this.APITests_Organization.sluglified_name}`);
      await this.organizationsService.addMembersById(this.APITests_Organization.id, [this.Rey_TeamAdminUser.id.toString()], [PlatformRole.TEAM_ADMIN_ROLE.name]);

      Logger.log(`Adding ${this.Leia_OrgAdmin.email} as ${PlatformRole.ORGANIZATION_ADMIN_ROLE.name} to ${this.APITests_Organization.sluglified_name}`);
      await this.organizationsService.addMembersById(this.APITests_Organization.id, [this.Leia_OrgAdmin.id.toString()], [PlatformRole.ORGANIZATION_ADMIN_ROLE.name]);
    } catch (ex) {
      Logger.error('Error at assignUsersToOrganizations', ex);
    }
  }

  private async assignUsersToTeams() {
    try {
      Logger.log(`Adding ${this.Gideon_OrganizationAdminUser.display_name} to team ${this.PrivateTeam.sluglified_name} with role ${this.CustomTeamRole.name}`);
      await this.teamsService.addMembersById(this.PrivateTeam.id, [this.Gideon_OrganizationAdminUser.id], [this.CustomTeamRole.name]);

      Logger.log(`Adding ${this.Rey_TeamAdminUser.display_name} to team ${this.PrivateTeam.sluglified_name} with role ${PlatformRole.TEAM_ADMIN_ROLE.name}`);
      await this.teamsService.addMembersById(this.PrivateTeam.id, [this.Rey_TeamAdminUser.id], [PlatformRole.TEAM_ADMIN_ROLE.name]);

      Logger.log(`Adding ${this.Ahsoka_ExternalUser.display_name} to team ${this.ProtectedTeamWithCustomRole.sluglified_name} with role ${PlatformRole.TEAM_CONTRIBUTOR_ROLE.name}`);
      await this.teamsService.addMembersById(this.ProtectedTeamWithCustomRole.id, [this.Ahsoka_ExternalUser.id], [PlatformRole.TEAM_CONTRIBUTOR_ROLE.name]);

      /* api-tests */
      Logger.log(`Adding ${this.Chewbacca_TeamReaderUser.display_name} to team ${this.APITests_PrivateChannel.sluglified_name} with role ${PlatformRole.TEAM_READER_ROLE.name}`);
      await this.teamsService.addMembersById(this.APITests_PrivateChannel.id, [this.Chewbacca_TeamReaderUser.id], [PlatformRole.TEAM_READER_ROLE.name]);
    } catch (ex) {
      Logger.error('Error at assignUsersToTeams', ex);
    }
  }

  private async createDiscussions() {
    try {
      Logger.log(`Creating discussions...`);
      const discussion_one = new CreateDiscussionRequestDTO(
        false,
        [],
        this.Palpatine_PlatformAdminUser.id,
        false,
        "Dark Star Engineering Discussion in which discuss how to harden the starship to avoid rebel's attacks. This discussion is public, so anyone in the galaxy can bring their own ideas",
        1,
        false,
        'Dark Star Engineering Main',
        [],
        false,
        this.PublicTeam.id,
        'Dark Star Engineering',
        'http://localhost:3000/idontknowwhyisthisimportant',
      );

      const discussion_two = new CreateDiscussionRequestDTO(
        false,
        [],
        this.Rey_TeamAdminUser.id,
        false,
        "Discussion to discuss how to break the empire's Dark Star, taking advantage of that they, for some reason, make her engineering discussion public...",
        1,
        false,
        'How to break the Dark Star main',
        [],
        false,
        this.ProtectedTeamWithCustomRole.id,
        "Breaking Dark's Star",
        'http://localhost:3000/idontknowwhyisthisimportantagain',
      );

      const discussion_three = new CreateDiscussionRequestDTO(
        false,
        [],
        this.Kylo_TeamContributorUser.id,
        false,
        'Should I stay at the darkside or change to the lightside?',
        1,
        false,
        'Should I stay at the darkside or change to the lightside Main',
        [],
        false,
        this.PublicTeam.id,
        "Kylo's thoughts",
        'http://localhost:3000/idontknowwhyisthisimportantagainangaing',
      );

      const entityD1: Discussion = await this.discussionsService.createDiscussion(discussion_one);

      // Add comments to every discussion
      const d1_c1 = new Comment(
        "We can't satisfy the deadline, I suggest to add a small gate and push to production. The probability to receive an attack there is ridiculous",
        "We can't satisfy the deadline, I suggest to add a small gate and push to production. The probability to receive an attack there is ridiculous",
        this.Gideon_OrganizationAdminUser.id,
        this.DeathStarEngineeringReport.id,
        null,
        null,
        [],
      );

      d1_c1.discussion_id = entityD1.id;
      const entityD1C1 = await this.commentsService.createComment(d1_c1);

      const d1_c2 = new Comment(
        "Are you sure Gideon? I don't want to lose the war for that...",
        "Are you sure Gideon? I don't want to lose the war for that...",
        this.Palpatine_PlatformAdminUser.id,
        this.DeathStarEngineeringReport.id,
        entityD1C1.comment_id,
        null,
        [],
      );

      d1_c2.discussion_id = entityD1.id;
      await this.commentsService.createComment(d1_c2);

      const d1_c3 = new Comment(
        "It's a good idea, if not you'll have delays and enter in a debt with Jabba",
        "It's a good idea, if not you'll have delays and enter in a debt with Jabba",
        this.Rey_TeamAdminUser.id,
        this.DeathStarEngineeringReport.id,
        null,
        null,
        [],
      );
      d1_c2.discussion_id = entityD1.id;

      await this.commentsService.createComment(d1_c3);

      const entityD2: Discussion = await this.discussionsService.createDiscussion(discussion_two);

      const d2_c1 = new Comment(
        "Folks, I just drop a message to Dark Star engineering discussion enforcing shitty Gideon argument, hopefully they'll do it and we can win hahahaha",
        "Folks, I just drop a message to Dark Star engineering discussion enforcing shitty Gideon argument, hopefully they'll do it and we can win hahahaha",
        this.Rey_TeamAdminUser.id,
        this.RebelScumCounterAttackReport.id,
        null,
        null,
        [],
      );

      d2_c1.discussion_id = entityD2.id;
      await this.commentsService.createComment(d2_c1);

      const d2_c2 = new Comment('RRWWWGG GGWWWRGHH RAWRGWAWGGR', 'RRWWWGG GGWWWRGHH RAWRGWAWGGR', this.Chewbacca_TeamReaderUser.id, this.RebelScumCounterAttackReport.id, null, null, []);

      d2_c2.discussion_id = entityD2.id;
      await this.commentsService.createComment(d2_c2);

      const d2_c3 = new Comment('Hahahahaha good one Chewy', 'Hahahahaha good one Chewy', this.Kylo_TeamContributorUser.id, this.RebelScumCounterAttackReport.id, null, null, []);

      d2_c3.discussion_id = entityD2.id;
      await this.commentsService.createComment(d2_c3);

      const entityD3: Discussion = await this.discussionsService.createDiscussion(discussion_three);

      const d3_c1 = new Comment(
        "I'm in a hurry, I want the power that the dark side brings to me, but I also like to be near Rey, I don't know why :S",
        "I'm in a hurry, I want the power that the dark side brings to me, but I also like to be near Rey, I don't know why :S",
        this.Kylo_TeamContributorUser.id,
        this.KyloThoughtsReport.id,
        null,
        null,
        [],
      );

      d3_c1.discussion_id = entityD3.id;
      await this.commentsService.createComment(d3_c1);
    } catch (ex) {
      Logger.error('Error at createDiscussions', ex);
    }
  }

  private async createTags(): Promise<void> {
    try {
      this.KylorenTag = await this.tagsService.createTag(new TagRequestDTO('kyloren'));
      this.AngerTag = await this.tagsService.createTag(new TagRequestDTO('anger'));
      this.DoubtsTag = await this.tagsService.createTag(new TagRequestDTO('doubts'));
      this.PokemonTag = await this.tagsService.createTag(new TagRequestDTO('pokemon'));
      this.PikachuTag = await this.tagsService.createTag(new TagRequestDTO('pikachu'));
      this.SecretTag = await this.tagsService.createTag(new TagRequestDTO('secret'));
      this.DeathTag = await this.tagsService.createTag(new TagRequestDTO('death'));
      this.ImperiumTag = await this.tagsService.createTag(new TagRequestDTO('imperium'));
      this.DeathStarTag = await this.tagsService.createTag(new TagRequestDTO('death star'));
      this.FreedomTag = await this.tagsService.createTag(new TagRequestDTO('freedom'));
      this.JediTag = await this.tagsService.createTag(new TagRequestDTO('jedi'));
    } catch (ex) {
      Logger.error('Error at createTags', ex);
    }
  }

  private async assignTagsToReports(): Promise<void> {
    try {
      await this.tagsService.assignTagToEntity(this.KylorenTag.id, this.KyloThoughtsReport.id, EntityEnum.REPORT);
      await this.tagsService.assignTagToEntity(this.AngerTag.id, this.KyloThoughtsReport.id, EntityEnum.REPORT);
      await this.tagsService.assignTagToEntity(this.DoubtsTag.id, this.KyloThoughtsReport.id, EntityEnum.REPORT);

      await this.tagsService.assignTagToEntity(this.PokemonTag.id, this.BestPokemonReport.id, EntityEnum.REPORT);
      await this.tagsService.assignTagToEntity(this.AngerTag.id, this.BestPokemonReport.id, EntityEnum.REPORT);
      await this.tagsService.assignTagToEntity(this.PikachuTag.id, this.BestPokemonReport.id, EntityEnum.REPORT);

      await this.tagsService.assignTagToEntity(this.AngerTag.id, this.DeathStarEngineeringReport.id, EntityEnum.REPORT);
      await this.tagsService.assignTagToEntity(this.SecretTag.id, this.DeathStarEngineeringReport.id, EntityEnum.REPORT);
      await this.tagsService.assignTagToEntity(this.DeathTag.id, this.DeathStarEngineeringReport.id, EntityEnum.REPORT);
      await this.tagsService.assignTagToEntity(this.ImperiumTag.id, this.DeathStarEngineeringReport.id, EntityEnum.REPORT);
      await this.tagsService.assignTagToEntity(this.DeathStarTag.id, this.DeathStarEngineeringReport.id, EntityEnum.REPORT);

      await this.tagsService.assignTagToEntity(this.FreedomTag.id, this.RebelScumCounterAttackReport.id, EntityEnum.REPORT);
      await this.tagsService.assignTagToEntity(this.JediTag.id, this.RebelScumCounterAttackReport.id, EntityEnum.REPORT);
      await this.tagsService.assignTagToEntity(this.DeathStarTag.id, this.RebelScumCounterAttackReport.id, EntityEnum.REPORT);
      await this.tagsService.assignTagToEntity(this.ImperiumTag.id, this.RebelScumCounterAttackReport.id, EntityEnum.REPORT);
    } catch (ex) {
      Logger.error('Error at assignTagsToReports', ex);
    }
  }
}
