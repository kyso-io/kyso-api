import { Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { GenericController } from 'src/generic/controller.generic'
import { HateoasLinker } from 'src/helpers/hateoasLinker'
import { Repository } from 'src/model/repository.model'
import { GithubReposService } from 'src/modules/github-repos/github-repos.service'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { GithubAccount } from './model/github-account.model'
import { GithubRepoPermissionsEnum } from './security/github-repos-permissions.enum'

@ApiTags('repos/github')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('repos/github')
export class GithubReposController extends GenericController<Repository> {
    constructor(private readonly reposService: GithubReposService) {
        super()
    }

    assignReferences(repo: Repository) {
        repo.self_url = HateoasLinker.createRef(`/repos/github/${repo.owner}/${repo.name}`)
        repo.tree_url = HateoasLinker.createRef(`/repos/github/${repo.owner}/${repo.name}/${repo.default_branch}/tree`)

        /* TODO: Does not appear in the documentation... it's correct?
        if (repo.report) repo.reportUrl = HateoasLinker.createRef(`/${repo.report}`)
        delete repo.report
        */
        return repo
    }

    @Get()
    @ApiOperation({
        summary: `Get and search repositories`,
        description: `By passing in the appropriate options, you can search for available repositories in the linked git provider account`,
    })
    @ApiResponse({
        status: 200,
        description: `Search results matching criteria`,
        type: Repository,
    })
    @Permission([GithubRepoPermissionsEnum.READ])
    async getRepos(@Query('filter') filter, @Query('page') page, @Query('per_page') perPage, @Req() req) {
        // LOGIN??

        const repos = await this.reposService.getRepos({
            user: req.user,
            filter,
            page,
            perPage,
        })

        repos.forEach((x) => this.assignReferences(x))

        return repos
    }

    @Get('/:repoOwner/:repoName')
    @ApiOperation({
        summary: `Get a single repository`,
        description: `Fetch data for a repository, after specifying the owner and the name of the repository`,
    })
    @ApiParam({
        name: 'repoOwner',
        required: true,
        description: 'Name of the owner of the repository to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'repoName',
        required: true,
        description: 'Name of the repository to fetch',
        schema: { type: 'string' },
    })
    @ApiResponse({
        status: 200,
        description: `The data of the specified repository`,
        type: Repository,
    })
    @Permission([GithubRepoPermissionsEnum.READ])
    async getRepo(@Param('repoOwner') repoOwner: string, @Param('repoName') repoName: string, @Req() req) {
        // LOGIN?? That's req.user? We trust in that?

        const repo = await req.reposService.getRepo(req.user, repoOwner, repoName)
        this.assignReferences(repo)

        return repo
    }

    @Get('/:repoOwner/:repoName/:branch/tree')
    @ApiOperation({
        summary: `Explore a repository tree`,
        description: `Get the tree of a specific repository`,
    })
    @ApiParam({
        name: 'repoOwner',
        required: true,
        description: 'Name of the owner of the repository to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'repoName',
        required: true,
        description: 'Name of the repository to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'branch',
        required: true,
        description: 'Branch to fetch content from. Accepts slashes.',
        schema: { type: 'string' },
    })
    @ApiResponse({
        status: 200,
        description: `The data of the specified repository`,
        type: Repository,
    })
    @Permission([GithubRepoPermissionsEnum.READ])
    async getRepoTree(@Param('repoOwner') repoOwner: string, @Param('repoName') repoName: string, @Param('branch') branch: string, @Req() req) {
        // LOGIN??

        const tree = await req.reposService.getRepoTree(repoOwner, repoName, branch)

        return tree
    }

    @Get('/user')
    @ApiOperation({
        summary: `Get git logged user info`,
        description: `Get data about the git provider account that was linked with the requesting user account.`,
    })
    @ApiResponse({
        status: 200,
        description: `The data of the specified repository`,
        type: GithubAccount,
    })
    @Permission([GithubRepoPermissionsEnum.READ])
    async getAuthenticatedUser() {
        // LOGIN??

        const user = await this.reposService.getUser()

        return user
    }

    @Get('/user/access_token/:accessToken')
    @ApiOperation({
        summary: `Get git user info by access token`,
        description: `Get data about the git provider account that belongs to the provided access token`,
    })
    @ApiParam({
        name: 'accessToken',
        required: true,
        description: `Github's access token related to the user you want to fetch data`,
        schema: { type: 'string' },
    })
    @ApiResponse({
        status: 200,
        description: `The data of the specified repository`,
        type: GithubAccount,
    })
    @Permission([GithubRepoPermissionsEnum.READ])
    async getUserByAccessToken(@Param('accessToken') accessToken: string) {
        const user = await this.reposService.getUserByAccessToken(accessToken)

        return user
    }

    @Get('/user/email/access_token/:accessToken')
    @ApiOperation({
        summary: `Get email user info by access token`,
        description: `Get email data about the git provider account that belongs to the provided access token`,
    })
    @ApiParam({
        name: 'accessToken',
        required: true,
        description: `Github's access token related to the user you want to fetch email data`,
        schema: { type: 'string' },
    })
    @ApiResponse({
        status: 200,
        description: `The data of the specified repository`,
        type: GithubAccount,
    })
    @Permission([GithubRepoPermissionsEnum.READ])
    async getUserEmailByAccessToken(@Param('accessToken') accessToken: string) {
        const email = await this.reposService.getEmailByAccessToken(accessToken)

        return email
    }
}
