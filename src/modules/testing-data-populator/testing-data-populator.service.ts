import { Injectable, Logger } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { Comment } from '../../model/comment.model'
import { CreateReport } from '../../model/dto/create-report-request.dto'
import { CreateUserRequest } from '../../model/dto/create-user-request.dto'
import { LoginProviderEnum } from '../../model/enum/login-provider.enum'
import { TeamVisibilityEnum } from '../../model/enum/team-visibility.enum'
import { KysoRole } from '../../model/kyso-role.model'
import { Organization } from '../../model/organization.model'
import { Report } from '../../model/report.model'
import { Team } from '../../model/team.model'
import { User } from '../../model/user.model'
import { GlobalPermissionsEnum } from '../../security/general-permissions.enum'
import { CommentsService } from '../comments/comments.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { ReportsService } from '../reports/reports.service'
import { ReportPermissionsEnum } from '../reports/security/report-permissions.enum'
import { TeamPermissionsEnum } from '../teams/security/team-permissions.enum'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'

@Injectable()
export class TestingDataPopulatorService {
    private Rey_TeamAdminUser: User
    private Kylo_TeamContributorUser: User
    private Chewbacca_TeamReaderUser: User
    private Gideon_OrganizationAdminUser: User
    private Palpatine_PlatformAdminUser: User

    private DarksideOrganization: Organization
    private LightsideOrganization: Organization

    private TestReport: Report
    private TestComment: Comment
    private TestChildComment1: Comment
    private TestChildComment2: Comment
    private CustomTeamRole: KysoRole
    private CustomOrganizationRole: KysoRole

    private PublicTeam: Team
    private ProtectedTeamWithCustomRole: Team
    private PrivateTeam: Team


    @Autowired(CommentsService)
    private commentsService: CommentsService

    @Autowired(UsersService)
    private usersService: UsersService
    
    @Autowired(OrganizationsService)
    private organizationsService: OrganizationsService
    
    @Autowired(TeamsService)
    private teamsService: TeamsService
    
    @Autowired(ReportsService)
    private reportsService: ReportsService

    public async populateTestData() {
        if (process.env.POPULATE_TEST_DATA && process.env.POPULATE_TEST_DATA === 'true') {
            Logger.log(`
                  ^     ^
                   ^   ^
                   (o o)
                  {  |  }  Testing data populator will create testing data in your database
                     "
            `)

            if (await this.checkIfAlreadyExists()) {
                Logger.log(`
                  THE TEST DATA ALREADY EXISTS. SKIPPING.
                `)
                return
            }

            await this.createTestingUsers()
            await this.createOrganizations()
            await this.createTeams()
            await this.assignUsersToOrganizations()
            await this.assignUsersToTeams()

            await this.createTestingReports()
            await this.createTestingComments()
        }
    }

    private async checkIfAlreadyExists() {
        // I assume only these two usernames exist if they were created by the test data populator
        const testUsersByUsername = await this.usersService.getUsers({ filter: { $or: [{ username: 'rey@kyso.io' }, { username: 'kylo@kyso.io' }] } })
        if (testUsersByUsername.length === 2) {
            return true
        }
        return false
    }

    private async createTestingUsers() {
        const rey_TestTeamAdminUser: CreateUserRequest = new CreateUserRequest(
            'rey@kyso.io',
            'rey@kyso.io',
            'rey',
            LoginProviderEnum.KYSO,
            '[Team Admin] Rey is a Team Admin',
            'free',
            'https://bit.ly/3Fgdosn',
            true,
            'n0tiene',
            [],
        )

        const kylo_TestTeamContributorUser: CreateUserRequest = new CreateUserRequest(
            'kylo@kyso.io',
            'kylo@kyso.io',
            'kyloren',
            LoginProviderEnum.KYSO,
            '[Team Contributor] Kylo Ren is a Team Contributor',
            'free',
            'https://bit.ly/3qfdNVo',
            true,
            'n0tiene',
            [],
        )

        const chewbacca_TestTeamReaderUser: CreateUserRequest = new CreateUserRequest(
            'chewbacca@kyso.io',
            'chewbacca@kyso.io',
            'chewbacca',
            LoginProviderEnum.KYSO,
            '[Team Reader] Chewbacca is a Team Reader',
            'free',
            'https://bit.ly/3slTUyI',
            true,
            'n0tiene',
            [],
        )

        const gideon_TestOrganizationAdminUser: CreateUserRequest = new CreateUserRequest(
            'gideon@kyso.io',
            'gideon@kyso.io',
            'moffgideon',
            LoginProviderEnum.KYSO,
            '[Organization Admin] Moff Gideon is an Organization Admin',
            'free',
            'https://bit.ly/3EWyNG6',
            true,
            'n0tiene',
            [],
        )

        const palpatine_TestPlatformAdminUser: CreateUserRequest = new CreateUserRequest(
            'palpatine@kyso.io',
            'palpatine@kyso.io',
            'palpatine',
            LoginProviderEnum.KYSO,
            '[Platform Admin] Palpatine is a platform admin',
            'free',
            'https://bit.ly/3e9b9ep',
            true,
            'n0tiene',
            [GlobalPermissionsEnum.GLOBAL_ADMIN],
        )

        this.Rey_TeamAdminUser = await this._createUser(rey_TestTeamAdminUser)
        this.Kylo_TeamContributorUser = await this._createUser(kylo_TestTeamContributorUser)
        this.Chewbacca_TeamReaderUser = await this._createUser(chewbacca_TestTeamReaderUser)
        this.Gideon_OrganizationAdminUser = await this._createUser(gideon_TestOrganizationAdminUser)
        this.Palpatine_PlatformAdminUser = await this._createUser(palpatine_TestPlatformAdminUser)
    }

    private async _createUser(user: CreateUserRequest) {
        try {
            Logger.log(`Creating ${user.nickname} user...`)
            return await this.usersService.createUser(user)
        } catch (ex) {
            Logger.log(`${user.nickname} user already exists`)
            return this.usersService.getUser({ email: user.email })
        }
    }

    private async createTestingReports() {
        const testReport = new CreateReport('kylos-report', 'team-contributor', null, 'main', '.')
        this.TestReport = await this._createReport(this.Kylo_TeamContributorUser, testReport)
    }

    private async _createReport(user: User, report: CreateReport) {
        try {
            Logger.log(`Creating ${report.name} report...`)
            return this.reportsService.createReport(user, report, null)
        } catch (ex) {
            Logger.log(`${report.name} report already exists`)
        }
    }

    private async createTestingComments() {
        const testComment = new Comment('test text', this.Kylo_TeamContributorUser.id, this.TestReport.id, null, this.Kylo_TeamContributorUser.username)
        this.TestComment = await this._createComment(testComment)

        this.TestChildComment1 = await this._createComment(
            new Comment('child test text', this.Kylo_TeamContributorUser.id, this.TestReport.id, this.TestComment.id, this.Kylo_TeamContributorUser.username),
        )

        this.TestChildComment2 = await this._createComment(
            new Comment('child 2 test text', this.Kylo_TeamContributorUser.id, this.TestReport.id, this.TestComment.id, this.Kylo_TeamContributorUser.username),
        )
    }

    private async _createComment(comment: Comment): Promise<Comment> {
        try {
            Logger.log(`Creating ${comment.text} comment...`)
            return this.commentsService.createComment(comment)
        } catch (ex) {
            Logger.log(`"${comment.text}" comment already exists`)
        }
    }

    private async createOrganizations() {
        const darksideOrganization: Organization = new Organization('darkside', [], 'darkside@kyso.io', 'random-stripe-id-with-no-use', false)

        this.DarksideOrganization = await this._createOrganization(darksideOrganization)

        this.CustomOrganizationRole = new KysoRole('custom-organization-random-role', [TeamPermissionsEnum.CREATE, TeamPermissionsEnum.DELETE])

        const lightsideOrganization: Organization = new Organization(
            'lightside',
            [this.CustomOrganizationRole],
            'lightside@kyso.io',
            'another-random-stripe-id-with-no-use',
            false,
        )

        this.LightsideOrganization = await this._createOrganization(lightsideOrganization)
    }

    private async _createOrganization(organization: Organization) {
        try {
            Logger.log(`Creating ${organization.name} organization...`)
            return await this.organizationsService.createOrganization(organization)
        } catch (ex) {
            Logger.log(` ${organization.name} organization already exists`)
        }
    }

    private async createTeams() {
        try {
            const publicTeam = new Team(
                'public-team',
                'https://bit.ly/3J49GUO',
                'A public team',
                'Cleveland',
                [],
                this.DarksideOrganization.id,
                TeamVisibilityEnum.PUBLIC,
            )

            this.CustomTeamRole = new KysoRole('custom-team-random-role', [ReportPermissionsEnum.READ])

            const protectedTeam = new Team(
                'protected-team',
                'https://bit.ly/3e9mDOZ',
                'A protected team with custom roles',
                'Sacramento',
                [this.CustomTeamRole],
                this.LightsideOrganization.id,
                TeamVisibilityEnum.PROTECTED,
            )

            const privateTeam = new Team(
                'private-team',
                'https://bit.ly/3sr8x45',
                'A private team',
                'Milwaukee',
                [this.CustomTeamRole],
                this.DarksideOrganization.id,
                TeamVisibilityEnum.PRIVATE,
            )

            this.PublicTeam = await this._createTeam(publicTeam)
            this.ProtectedTeamWithCustomRole = await this._createTeam(protectedTeam)
            this.PrivateTeam = await this._createTeam(privateTeam)
        } catch (ex) {
            // silent exception
        }
    }

    private async _createTeam(team: Team) {
        try {
            Logger.log(`Creating ${team.name} team...`)
            return await this.teamsService.createTeam(team)
        } catch (ex) {
            Logger.log(` ${team.name} team already exists`)
        }
    }

    private async assignUsersToOrganizations() {
        try {
            /*** Darkside organization ***/

            // Organization admin
            await this.organizationsService.addMembersById(
                this.DarksideOrganization.id,
                [this.Gideon_OrganizationAdminUser.id.toString()],
                [KysoRole.ORGANIZATION_ADMIN_ROLE.name],
            )

            await this.organizationsService.addMembersById(
                this.DarksideOrganization.id,
                [this.Kylo_TeamContributorUser.id.toString()],
                [KysoRole.TEAM_CONTRIBUTOR_ROLE.name],
            )

            /*** Lightside organization ***/
            await this.organizationsService.addMembersById(this.LightsideOrganization.id, [this.Rey_TeamAdminUser.id], [KysoRole.TEAM_ADMIN_ROLE.name])

            await this.organizationsService.addMembersById(this.LightsideOrganization.id, [this.Kylo_TeamContributorUser.id], [KysoRole.TEAM_READER_ROLE.name])

            await this.organizationsService.addMembersById(
                this.LightsideOrganization.id,
                [this.Chewbacca_TeamReaderUser.id.toString()],
                [KysoRole.TEAM_READER_ROLE.name],
            )
        } catch (ex) {
            // silent exception for now ;)
        }
    }

    private async assignUsersToTeams() {
        try {
            Logger.log(`Adding ${this.Gideon_OrganizationAdminUser.nickname} to team ${this.PrivateTeam.name} with role ${this.CustomTeamRole.name}`)
            await this.teamsService.addMembersById(this.PrivateTeam.id, [this.Gideon_OrganizationAdminUser.id], [this.CustomTeamRole.name])

            Logger.log(`Adding ${this.Rey_TeamAdminUser.nickname} to team ${this.PrivateTeam.name} with role ${KysoRole.TEAM_ADMIN_ROLE.name}`)
            await this.teamsService.addMembersById(this.PrivateTeam.id, [this.Rey_TeamAdminUser.id], [KysoRole.TEAM_ADMIN_ROLE.name])
        } catch (ex) {
            // silent it
        }
    }
}
