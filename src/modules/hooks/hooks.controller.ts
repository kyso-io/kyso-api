import { LoginProviderEnum, Report, RepositoryProvider, User, UserAccount } from '@kyso-io/kyso-model'
import { Body, Controller, Logger, Post } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { ReportsService } from '../reports/reports.service'
import { UsersService } from '../users/users.service'

@Controller('hooks')
export class HooksController {
    @Autowired({ typeName: 'ReportsService' })
    private reportsService: ReportsService

    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Post('github')
    public async githubHook(@Body() body: any): Promise<void> {
        if (!body || !body.hasOwnProperty('repository')) {
            return
        }
        const { repository } = body
        const reports: Report[] = await this.reportsService.getReports({
            filter: {
                provider_id: repository.id.toString(),
                provider: RepositoryProvider.GITHUB,
                name: repository.name,
            },
        })
        if (reports.length === 0) {
            Logger.error(`No report found for github repository ${repository.name}`, HooksController.name)
            return
        }
        const report: Report = reports[0]

        let sha = null
        if (body.head_commit?.id) {
            sha = body.head_commit.id
        } else {
            sha = body.commits[0].id
        }

        const user: User = await this.usersService.getUserById(report.user_id)
        if (!user) {
            Logger.error(`No user found for Github report '${report.id} ${report.sluglified_name}'`, HooksController.name)
            return
        }
        const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
        if (!userAccount) {
            Logger.error(`No Github account found for user '${user.id} ${user.name}'`, HooksController.name)
            return
        }

        this.reportsService.downloadGithubRepo(report, repository, sha, userAccount)
    }

    @Post('bitbucket')
    public async bitbucketHook(@Body() body: any): Promise<void> {
        const report: Report = await this.reportsService.getReport({ filter: { name: body.repository.full_name } })
        if (!report) {
            Logger.error(`No report found for bitbucket repository ${body.repository.full_name}`, HooksController.name)
            return
        }
        const user: User = await this.usersService.getUserById(report.user_id)
        if (!user) {
            Logger.error(`No user found for Github report '${report.id} ${report.sluglified_name}'`, HooksController.name)
            return
        }
        const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.BITBUCKET)
        if (!userAccount) {
            Logger.error(`No Github account found for user '${user.id} ${user.name}'`, HooksController.name)
            return
        }
        const sha: string = body.push.changes[0].commits[0].hash
        this.reportsService.downloadBitbucketRepo(report, body.repository.full_name, sha, userAccount)
    }
}
