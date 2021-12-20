import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { Organization } from 'src/model/organization.model'
import { Team } from 'src/model/team.model'
import { User } from 'src/model/user.model'
import { GlobalPermissionsEnum } from 'src/security/general-permissions.enum'
import { KysoRole } from '../auth/model/kyso-role.model'
import { LoginProvider } from '../auth/model/login-provider.enum'
import { OrganizationsService } from '../organizations/organizations.service'
import { ReportPermissionsEnum } from '../reports/security/report-permissions.enum'
import { CreateTeamRequest } from '../teams/model/create-team-request.model'
import { TeamPermissionsEnum } from '../teams/security/team-permissions.enum'
import { TeamsService } from '../teams/teams.service'
import { CreateUserRequest } from '../users/dto/create-user-request.dto'
import { UsersService } from '../users/users.service'

@Injectable()
export class TestingDataPopulatorService implements OnApplicationBootstrap {
    private TeamAdminUser: User
    private TeamContributorUser: User
    private TeamReaderUser: User
    private OrganizationAdminUser: User
    private PlatformAdminUser: User

    private RegularOrganization: Organization
    private OrganizationWithCustomRole: Organization

    private RegularTeam: any
    private TeamWithCustomRole: any

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
        const testTeamAdminUser: CreateUserRequest = new CreateUserRequest(
            'team-admin@kyso.io',
            'team-admin@kyso.io',
            'team-admin',
            LoginProvider.KYSO,
            '',
            'free',
            'n0tiene',
            [],
        )

        const testTeamContributorUser: CreateUserRequest = new CreateUserRequest(
            'team-contributor@kyso.io',
            'team-contributor@kyso.io',
            'team-contributor',
            LoginProvider.KYSO,
            '',
            'free',
            'n0tiene',
            [],
        )
        const testTeamReaderUser: CreateUserRequest = new CreateUserRequest(
            'team-reader@kyso.io',
            'team-reader@kyso.io',
            'team-reader',
            LoginProvider.KYSO,
            '',
            'free',
            'n0tiene',
            [],
        )

        const testOrganizationAdminUser: CreateUserRequest = new CreateUserRequest(
            'organization-admin@kyso.io',
            'organization-admin@kyso.io',
            'organization-admin',
            LoginProvider.KYSO,
            '',
            'free',
            'n0tiene',
            [],
        )

        const testPlatformAdminUser: CreateUserRequest = new CreateUserRequest(
            'platform-admin@kyso.io',
            'platform-admin@kyso.io',
            'platform-admin',
            LoginProvider.KYSO,
            '',
            'free',
            'n0tiene',
            [GlobalPermissionsEnum.GLOBAL_ADMIN],
        )

        this.TeamAdminUser = await this._createUser(testTeamAdminUser)
        this.TeamContributorUser = await this._createUser(testTeamContributorUser)
        this.TeamReaderUser = await this._createUser(testTeamReaderUser)
        this.OrganizationAdminUser = await this._createUser(testOrganizationAdminUser)
        this.PlatformAdminUser = await this._createUser(testPlatformAdminUser)
    }

    private async _createUser(user: CreateUserRequest) {
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
        const regularTeam = new Team("regular-team", "https://bit.ly/3J49GUO", "A regular team", "Valencia", 
            [], this.RegularOrganization.id)

        const customRole: KysoRole = new KysoRole('custom-team-random-role', [ReportPermissionsEnum.READ])

        const teamWithCustomRoles = new Team("custom-roles-team", "https://bit.ly/3e9mDOZ", "A team with custom roles", "Texas", 
            [customRole], this.OrganizationWithCustomRole.id)
        
        this.RegularTeam = this._createTeam(regularTeam)
        this.TeamWithCustomRole = this._createTeam(teamWithCustomRoles)
    }

    private async _createTeam(team: CreateTeamRequest) {
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

    private async assignTeamsToOrganizations() {

    }

    private async assignUsersToTeams() {}
}
