import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { Organization } from 'src/model/organization.model'
import { Team } from 'src/model/team.model'
import { User } from 'src/model/user.model'
import { GlobalPermissionsEnum } from 'src/security/general-permissions.enum'
import { KysoRole } from '../../model/kyso-role.model'
import { LoginProviderEnum } from '../../model/enum/login-provider.enum'
import { OrganizationsService } from '../organizations/organizations.service'
import { ReportPermissionsEnum } from '../reports/security/report-permissions.enum'
import { TeamPermissionsEnum } from '../teams/security/team-permissions.enum'
import { TeamsService } from '../teams/teams.service'
import { CreateUserRequest } from '../../model/dto/create-user-request.dto'
import { UsersService } from '../users/users.service'
import { TeamVisibilityEnum } from 'src/model/enum/team-visibility.enum'

@Injectable()
export class TestingDataPopulatorService implements OnApplicationBootstrap {
    private TeamAdminUser: User
    private TeamContributorUser: User
    private TeamReaderUser: User
    private OrganizationAdminUser: User
    private PlatformAdminUser: User

    private RegularOrganization: Organization
    private OrganizationWithCustomRole: Organization

    private PublicTeam: any
    private ProtectedTeamWithCustomRole: any
    private PrivateTeam: any

    constructor(
        private readonly usersService: UsersService,
        private readonly organizationService: OrganizationsService,
        private readonly teamService: TeamsService,
    ) {}

    async onApplicationBootstrap() {
        if (process.env.POPULATE_TEST_DATA && process.env.POPULATE_TEST_DATA === 'true') {
            console.log(`
                  ^     ^
                   ^   ^
                   (o o)
                  {  |  }  Testing data populator will create testing data in your database
                     "
            `)

            await this.createTestingUsers()
            await this.createOrganizations()
            await this.createTeams()
            await this.assignUsersToOrganizations()
        }
    }

    private async createTestingUsers() {
        const rey_TestTeamAdminUser: User = new User(
            'rey@kyso.io',
            'rey@kyso.io',
            'Rey',
            LoginProviderEnum.KYSO,
            '[Team Admin] Rey is a Team Admin',
            'free',
            'n0tiene',
            'https://bit.ly/3Fgdosn',
            true,
            [],
        )

        const kylo_TestTeamContributorUser: User = new User(
            'kylo@kyso.io',
            'kylo@kyso.io',
            'Kylo Ren',
            LoginProviderEnum.KYSO,
            '[Team Contributor] Kylo Ren is a Team Contributor',
            'free',
            'n0tiene',
            'https://bit.ly/3qfdNVo',
            true,
            [],
        )

        const chewbacca_TestTeamReaderUser: User = new User(
            'chewbacca@kyso.io',
            'chewbacca@kyso.io',
            'chewbacca',
            LoginProviderEnum.KYSO,
            '[Team Reader] Chewbacca is a Team Reader',
            'free',
            'n0tiene',
            'https://bit.ly/3slTUyI',
            true,
            [],
        )

        const gideon_TestOrganizationAdminUser: User = new User(
            'gideon@kyso.io',
            'gideon@kyso.io',
            'Moff Gideon',
            LoginProviderEnum.KYSO,
            '[Organization Admin] Moff Gideon is an Organization Admin',
            'free',
            'n0tiene',
            'https://bit.ly/3E8x5AN', 
            true,
            [],
        )

        const palpatine_TestPlatformAdminUser: User = new User(
            'palpatine@kyso.io',
            'palpatine@kyso.io',
            'Palpatine',
            LoginProviderEnum.KYSO,
            '[Platform Admin] Palpatine is a platform admin',
            'free',
            'n0tiene',
            'https://bit.ly/3e9b9ep',
            true,
            [GlobalPermissionsEnum.GLOBAL_ADMIN],
        )

        this.TeamAdminUser = await this._createUser(rey_TestTeamAdminUser)
        this.TeamContributorUser = await this._createUser(kylo_TestTeamContributorUser)
        this.TeamReaderUser = await this._createUser(chewbacca_TestTeamReaderUser)
        this.OrganizationAdminUser = await this._createUser(gideon_TestOrganizationAdminUser)
        this.PlatformAdminUser = await this._createUser(palpatine_TestPlatformAdminUser)
    }

    private async _createUser(user: User) {
        try {
            Logger.log(`Creating ${user.nickname} user...`)
            return await this.usersService.createUser(user)
        } catch (ex) {
            Logger.log(`${user.nickname} user already exists`)
        }
    }

    private async createOrganizations() {
        const regularOrganization: Organization = new Organization(
            'Organization without specific roles',
            [],
            'regular-organization@kyso.io',
            'random-stripe-id-with-no-use',
            false
        )

        this.RegularOrganization = await this._createOrganization(regularOrganization)

        const customRole: KysoRole = new KysoRole('custom-organization-random-role', [TeamPermissionsEnum.CREATE, TeamPermissionsEnum.DELETE])

        const organizationWithCustomRoles: Organization = new Organization(
            'Organization with custom roles',
            [customRole],
            'organization-with-custom-roles@kyso.io',
            'another-random-stripe-id-with-no-use',
            false,
        )

        this.OrganizationWithCustomRole = await this._createOrganization(organizationWithCustomRoles)
    }

    private async _createOrganization(organization: Organization) {
        try {
            Logger.log(`Creating ${organization.name} organization...`)
            return await this.organizationService.createOrganization(organization)
        } catch (ex) {
            Logger.log(` ${organization.name} organization already exists`)
        }
    }

    private async createTeams() {
        try {
            const regularTeam = new Team("public-team", "https://bit.ly/3J49GUO", "A public team", "Cleveland", 
                [], this.RegularOrganization.id, TeamVisibilityEnum.PUBLIC)

            const customRole: KysoRole = new KysoRole('custom-team-random-role', [ReportPermissionsEnum.READ])

            const teamWithCustomRoles = new Team("protected-team-with-roles", "https://bit.ly/3e9mDOZ", "A protected team with custom roles", "Sacramento", 
                [customRole], this.OrganizationWithCustomRole.id, TeamVisibilityEnum.PROTECTED)
            
            const privateTeam = new Team("private-team", "https://bit.ly/3sr8x45", "A private team", "Milwaukee", 
                [customRole], this.RegularOrganization.id, TeamVisibilityEnum.PRIVATE)
            
            this.PublicTeam = this._createTeam(regularTeam)
            this.ProtectedTeamWithCustomRole = this._createTeam(teamWithCustomRoles)
        } catch(ex) {
            // silent exception
        }
    }

    private async _createTeam(team: Team) {
        try {
            Logger.log(`Creating ${team.name} team...`)
            return await this.teamService.createTeam(team)
        } catch (ex) {
            Logger.log(` ${team.name} team already exists`)
        }
    }

    private async assignUsersToOrganizations() {
        try {
            // Organization admin
            await this.organizationService.addMembersById(
                this.RegularOrganization.id,
                [this.OrganizationAdminUser.id.toString()],
                [KysoRole.ORGANIZATION_ADMIN_ROLE.name],
            )

            // Team admin for all teams in the organization
            await this.organizationService.addMembersById(this.RegularOrganization.id, [this.TeamAdminUser.id.toString()], [KysoRole.TEAM_ADMIN_ROLE.name])

            // Team contributor for all teams in the organization
            await this.organizationService.addMembersById(
                this.RegularOrganization.id,
                [this.TeamContributorUser.id.toString()],
                [KysoRole.TEAM_CONTRIBUTOR_ROLE.name],
            )

            // Team reader for all teams in the organization
            await this.organizationService.addMembersById(
                this.RegularOrganization.id,
                [this.TeamContributorUser.id.toString()],
                [KysoRole.TEAM_READER_ROLE.name],
            )
        } catch (ex) {
            // silent exception for now ;)
        }
    }

    private async assignUsersToTeams() {

    }
}
