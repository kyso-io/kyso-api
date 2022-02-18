import { GithubFileHash, GithubRepository, LoginProviderEnum, NormalizedResponseDTO, Repository, Token, User, UserAccount } from '@kyso-io/kyso-model'
import { Controller, Get, Param, PreconditionFailedException, Query } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { GenericController } from '../../generic/controller.generic'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { UsersService } from '../users/users.service'
import { BitbucketReposProvider } from './providers/bitbucket-repo.provider'

@ApiTags('repos/bitbucket')
@Controller('repos/bitbucket')
export class BitbucketReposController extends GenericController<Repository> {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    constructor(private readonly bitbucketReposProvider: BitbucketReposProvider) {
        super()
    }

    assignReferences(repo: Repository) {
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
        @CurrentToken() token: Token,
        @Query('filter') filter,
        @Query('page') page,
        @Query('per_page') perPage,
    ): Promise<NormalizedResponseDTO<GithubRepository[]>> {
        const user: User = await this.usersService.getUserById(token.id)
        const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.BITBUCKET)
        if (!userAccount) {
            throw new PreconditionFailedException('User does not have a bitbucket account')
        }
        const data: any = await this.bitbucketReposProvider.getWorkspaces(userAccount.username, userAccount.accessToken, 1, 100)
        let workspaces: string[] = []
        if (data?.values && Array.isArray(data.values) && data.values.length > 0) {
            workspaces = data.values.map((workspace: any) => workspace.slug)
        }
        const repos: GithubRepository[] = await Promise.all(
            workspaces.map((workspace: string) =>
                this.bitbucketReposProvider.searchRepos(userAccount.username, userAccount.accessToken, workspace, filter, page, perPage),
            ),
        )
        return new NormalizedResponseDTO(repos)
    }

    @Get('/user')
    @ApiOperation({
        summary: `Get data about the git provider account that was linked with the requesting user account.`,
    })
    @ApiResponse({
        status: 200,
        description: `The data of the specified repository`,
    })
    async getAuthenticatedUser(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<any>> {
        try {
            const user: User = await this.usersService.getUserById(token.id)
            const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.BITBUCKET)
            if (!userAccount) {
                throw new PreconditionFailedException('User does not have a bitbucket account')
            }
            const bitbucketAccount: any = await this.bitbucketReposProvider.getUser(userAccount.username, userAccount.accessToken)
            return new NormalizedResponseDTO(bitbucketAccount)
        } catch (e) {
            console.log(e)
            return new NormalizedResponseDTO(null)
        }
    }

    @Get('/repository')
    @ApiOperation({
        summary: `Get a single repository given name`,
        description: `Fetch data for a repository, after specifying the owner and the name of the repository`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `The data of the specified repository`,
        type: Repository,
    })
    async getRepo(@CurrentToken() token: Token, @Query('name') name: string): Promise<NormalizedResponseDTO<GithubRepository>> {
        try {
            if (!name || name.length === 0) {
                throw new PreconditionFailedException('Repository name is required')
            }
            const user: User = await this.usersService.getUserById(token.id)
            const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.BITBUCKET)
            if (!userAccount) {
                throw new PreconditionFailedException('User does not have a bitbucket account')
            }
            const repository: GithubRepository = await this.bitbucketReposProvider.getRepo(userAccount.username, userAccount.accessToken, name)
            return new NormalizedResponseDTO(repository)
        } catch (e) {
            return new NormalizedResponseDTO(null)
        }
    }

    @Get('/:branch/tree')
    @ApiOperation({
        summary: `Explore a repository tree`,
        description: `Get the tree of a specific repository`,
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
    async getRepoTree(
        @CurrentToken() token: Token,
        @Param('branch') branch: string,
        @Query('name') name: string,
        @Param('path') path: string,
    ): Promise<NormalizedResponseDTO<{ nextPageCode: string; data: GithubFileHash[] }>> {
        try {
            if (!name || name.length === 0) {
                throw new PreconditionFailedException('Repository name is required')
            }
            const user: User = await this.usersService.getUserById(token.id)
            const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.BITBUCKET)
            if (!userAccount) {
                throw new PreconditionFailedException('User does not have a bitbucket account')
            }
            const tree: { nextPageCode: string; data: GithubFileHash[] } = await this.bitbucketReposProvider.getRootFilesAndFoldersByCommit(
                userAccount.username,
                userAccount.accessToken,
                name,
                branch,
                path,
                null,
            )
            return new NormalizedResponseDTO(tree)
        } catch (e) {
            console.log(e)
            return new NormalizedResponseDTO(null)
        }
    }
}
