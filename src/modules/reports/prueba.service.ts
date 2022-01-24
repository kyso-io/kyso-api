import {
    CreateReportDTO,
    GithubBranch,
    GithubCommit,
    GithubFileHash,
    GithubRepository,
    KysoConfigFile,
    Report,
    RepositoryProvider,
    Team,
} from '@kyso-io/kyso-model'
import { Injectable, PreconditionFailedException } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { GithubReposService } from '../github-repos/github-repos.service'
import { TeamsService } from '../teams/teams.service'
import { ReportsService } from './reports.service'

@Injectable()
export class PruebaService {
    @Autowired({ typeName: 'GithubReposService' })
    private githubReposService: GithubReposService

    @Autowired({ typeName: 'ReportsService' })
    private reportsService: ReportsService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    constructor() {
        // setTimeout(() => this.createReport(), 1000)
        // setTimeout(() => this.getBranches(), 1000)
        // setTimeout(() => this.getCommits(), 1000)
        // setTimeout(() => this.getFileHash(), 1000)
        // setTimeout(() => this.getFileContent(), 1000)
    }

    private async createReport(): Promise<void> {
        const createReportDto: CreateReportDTO = new CreateReportDTO(
            'kronig-penney-exploration',
            'fran-kyso',
            RepositoryProvider.GITHUB,
            'master',
            '',
            '61e98e5e53b5a74f37ccd6a2',
        )
        const userId = '61e98e5e53b5a74f37ccd69f'
        const accessToken = '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'
        this.githubReposService.login(accessToken)
        const githubRepository: GithubRepository = await this.githubReposService.getGithubRepository(createReportDto.username_provider, createReportDto.name)
        console.log(githubRepository)

        const team: Team = await this.teamsService.getTeamById(createReportDto.team_id)
        if (!team) {
            throw new PreconditionFailedException("The specified team couldn't be found")
        }

        // Check if exists a report with this name
        const reports: Report[] = await this.reportsService.getReports({
            filter: {
                name: createReportDto.name,
            },
        })
        if (reports.length !== 0) {
            throw new PreconditionFailedException({
                message: 'The specified name is already used by another report',
            })
        }

        const metadata: KysoConfigFile = await this.githubReposService.getConfigFile(
            createReportDto.path,
            createReportDto.username_provider,
            createReportDto.name,
            createReportDto.default_branch,
        )

        const report: Report = new Report(
            createReportDto.name, // name
            createReportDto.provider, // provider
            createReportDto.username_provider, // username_provider
            createReportDto.default_branch, // default_branch
            '', // path
            0, // views
            false, // pin
            metadata.description, // description
            userId, // user_id
            team.id, // team_id
        )
    }

    private async getBranches(): Promise<void> {
        const accessToken = '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'
        const githubUsername = 'fran-kyso'
        const repositoryName = 'kronig-penney-exploration'
        this.githubReposService.login(accessToken)
        const branches: GithubBranch[] = await this.githubReposService.getBranches(githubUsername, repositoryName)
        console.log(branches)
    }

    private async getCommits(): Promise<void> {
        const accessToken = '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'
        const githubUsername = 'fran-kyso'
        const repositoryName = 'kronig-penney-exploration'
        const branch = 'master'
        this.githubReposService.login(accessToken)
        const commits: GithubCommit[] = await this.githubReposService.getCommits(githubUsername, repositoryName, branch)
        console.log(commits)
    }

    private async getFileHash(): Promise<void> {
        const accessToken = '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'
        const fullPath = ''
        const githubUsername = 'fran-kyso'
        const repositoryName = 'kronig-penney-exploration'
        const branch = 'master'
        this.githubReposService.login(accessToken)
        const githubFileHash: GithubFileHash | GithubFileHash[] = await this.githubReposService.getFileHash(fullPath, githubUsername, repositoryName, branch)
        console.log(githubFileHash)
    }

    private async getFileContent(): Promise<void> {
        const accessToken = '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'
        const hash = 'f82bf3da2bfe64a1a9f58ba2e7f4c2b84ae9aa63'
        const githubUsername = 'fran-kyso'
        const repositoryName = 'kronig-penney-exploration'
        this.githubReposService.login(accessToken)
        const content: Buffer = await this.githubReposService.getFileContent(hash, githubUsername, repositoryName)
        console.log(JSON.parse(content.toString()))
    }
}
