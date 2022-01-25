import { GithubAccount, NormalizedResponseDTO, Repository } from '@kyso-io/kyso-model'
import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { GenericController } from '../../generic/controller.generic'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { GithubReposService } from './github-repos.service'
import { GithubRepoPermissionsEnum } from './security/github-repos-permissions.enum'

@ApiTags('repos/github')
@ApiExtraModels(GithubAccount, Repository)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('repos/github')
export class GithubReposController extends GenericController<Repository> {
    constructor(private readonly reposService: GithubReposService) {
        super()
    }

    assignReferences(repo: Repository) {
        return repo
    }

    @Get()
    @ApiOperation({
        summary: `Get and search repositories`,
        description: `By passing in the appropriate options, you can search for available repositories in the linked git provider account`,
    })
    @ApiNormalizedResponse({
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

        return new NormalizedResponseDTO(repos)
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
    @ApiNormalizedResponse({
        status: 200,
        description: `The data of the specified repository`,
        type: Repository,
    })
    @Permission([GithubRepoPermissionsEnum.READ])
    async getRepo(@Param('repoOwner') repoOwner: string, @Param('repoName') repoName: string, @Req() req): Promise<NormalizedResponseDTO<any>> {
        const repository: any = await this.reposService.getGithubRepository(repoOwner, repoName)
        // this.assignReferences(repo)
        return new NormalizedResponseDTO(repository)
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
    @ApiNormalizedResponse({
        status: 200,
        description: `The data of the specified repository`,
        type: Repository,
    })
    @Permission([GithubRepoPermissionsEnum.READ])
    async getRepoTree(@Param('repoOwner') repoOwner: string, @Param('repoName') repoName: string, @Param('branch') branch: string, @Req() req) {
        // LOGIN??

        const tree = await req.reposService.getRepoTree(repoOwner, repoName, branch)

        return new NormalizedResponseDTO(tree)
    }

    @Get('/user')
    @ApiOperation({
        summary: `Get git logged user info`,
        description: `Get data about the git provider account that was linked with the requesting user account.`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `The data of the specified repository`,
        type: GithubAccount,
    })
    @Permission([GithubRepoPermissionsEnum.READ])
    async getAuthenticatedUser() {
        // LOGIN??

        const user = await this.reposService.getUser()

        return new NormalizedResponseDTO(user)
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
    @ApiNormalizedResponse({
        status: 200,
        description: `The data of the specified repository`,
        type: GithubAccount,
    })
    @Permission([GithubRepoPermissionsEnum.READ])
    async getUserByAccessToken(@Param('accessToken') accessToken: string) {
        const user = await this.reposService.getUserByAccessToken(accessToken)

        return new NormalizedResponseDTO(user)
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
    @ApiNormalizedResponse({
        status: 200,
        description: `The data of the specified repository`,
        type: GithubAccount,
    })
    @Permission([GithubRepoPermissionsEnum.READ])
    async getUserEmailByAccessToken(@Param('accessToken') accessToken: string) {
        const email = await this.reposService.getEmailByAccessToken(accessToken)

        return new NormalizedResponseDTO(email)
    }
}
