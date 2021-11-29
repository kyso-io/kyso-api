import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { GenericController } from 'src/generic/controller.generic'
import { HateoasLinker } from 'src/helpers/hateoasLinker'
import { Repository } from 'src/model/repository.model'
import { BitbucketReposProvider } from './providers/bitbucket-repo.provider'

@ApiTags('repos/bitbucket')
@Controller('repos/bitbucket')
export class BitbucketReposController extends GenericController<Repository> {
    constructor(private readonly reposService: BitbucketReposProvider) {
        super()
    }

    assignReferences(repo: Repository) {
        repo.self_url = HateoasLinker.createRef(
            `/repos/github/${repo.owner}/${repo.name}`,
        )
        repo.tree_url = HateoasLinker.createRef(
            `/repos/github/${repo.owner}/${repo.name}/${repo.default_branch}/tree`,
        )

        /* TODO: Does not appear in the documentation... it's correct?
        if (repo.report) repo.reportUrl = HateoasLinker.createRef(`/${repo.report}`)
        delete repo.report
        */
        return repo
    }

    @Get()
    @ApiOperation({
        summary: `By passing in the appropriate options, you can search for available repositories in the linked git provider account`,
    })
    @ApiResponse({
        status: 200,
        description: `Search results matching criteria`,
        type: Repository,
    })
    async getRepos(
        @Query('filter') filter,
        @Query('page') page,
        @Query('per_page') perPage,
        @Req() req,
    ) {
        // TODO
    }

    @Get('/:repoOwner/:repoName')
    @ApiOperation({
        summary: `Fetch data for a repository, after specifying the owner and the name of the repository`,
    })
    @ApiResponse({
        status: 200,
        description: `The data of the specified repository`,
        type: Repository,
    })
    async getRepo(
        @Param('repoOwner') repoOwner: string,
        @Param('repoName') repoName: string,
        @Req() req,
    ) {
        // TODO
    }

    @Get('/:repoOwner/:repoName/:branch/tree')
    @ApiOperation({
        summary: `Get the tree of a specific repository`,
    })
    @ApiResponse({
        status: 200,
        description: `The data of the specified repository`,
        type: Repository,
    })
    async getRepoTree(
        @Param('repoOwner') repoOwner: string,
        @Param('repoName') repoName: string,
        @Param('branch') branch: string,
        @Req() req,
    ) {
        // TODO
    }

    @Get('/user')
    @ApiOperation({
        summary: `Get data about the git provider account that was linked with the requesting user account.`,
    })
    @ApiResponse({
        status: 200,
        description: `The data of the specified repository` /* type: GithubAccount */,
    })
    async getAuthenticatedUser() {
        // TODO
    }
}
