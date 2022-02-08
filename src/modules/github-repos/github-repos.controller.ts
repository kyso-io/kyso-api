import {
    GithubAccount,
    GithubEmail,
    GithubFileHash,
    GithubRepository,
    HEADER_X_KYSO_ORGANIZATION,
    HEADER_X_KYSO_TEAM,
    LoginProviderEnum,
    NormalizedResponseDTO,
    Repository,
    Token,
    User,
    UserAccount,
} from '@kyso-io/kyso-model'
import { Controller, Get, Param, PreconditionFailedException, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { GenericController } from '../../generic/controller.generic'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { UsersService } from '../users/users.service'
import { GithubReposService } from './github-repos.service'
import { GithubRepoPermissionsEnum } from './security/github-repos-permissions.enum'

@ApiTags('repos/github')
@ApiExtraModels(GithubAccount, Repository)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('repos/github')
@ApiHeader({
    name: HEADER_X_KYSO_ORGANIZATION,
    description: 'active organization (i.e: lightside)',
    required: true,
})
@ApiHeader({
    name: HEADER_X_KYSO_TEAM,
    description: 'active team (i.e: protected-team)',
    required: true,
})
export class GithubReposController extends GenericController<Repository> {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    constructor(private readonly githubReposService: GithubReposService) {
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
    async getRepos(
        @CurrentToken() token: Token,
        @Query('filter') filter,
        @Query('page') page,
        @Query('per_page') perPage,
    ): Promise<NormalizedResponseDTO<GithubRepository[]>> {
        const user: User = await this.usersService.getUserById(token.id)
        const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
        if (!userAccount) {
            throw new PreconditionFailedException('User does not have a github account')
        }
        const repos: GithubRepository[] = await this.githubReposService.getRepos(userAccount.accessToken, {
            filter,
            page,
            perPage,
        })
        return new NormalizedResponseDTO(repos)
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
    public async getAuthenticatedUser(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<GithubAccount>> {
        try {
            const user: User = await this.usersService.getUserById(token.id)
            const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
            if (!userAccount) {
                throw new PreconditionFailedException('User does not have a github account')
            }
            const githubUser: GithubAccount = await this.githubReposService.getUser(userAccount.accessToken)
            return new NormalizedResponseDTO(githubUser)
        } catch (e) {
            console.log(e)
            return new NormalizedResponseDTO(null)
        }
    }

    @Get('/:repoName')
    @ApiOperation({
        summary: `Get a single repository`,
        description: `Fetch data for a repository, after specifying the owner and the name of the repository`,
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
    async getRepo(@CurrentToken() token: Token, @Param('repoName') repoName: string): Promise<NormalizedResponseDTO<GithubRepository>> {
        try {
            const user: User = await this.usersService.getUserById(token.id)
            const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
            if (!userAccount) {
                throw new PreconditionFailedException('User does not have a github account')
            }
            const repository: GithubRepository = await this.githubReposService.getGithubRepository(userAccount.accessToken, userAccount.username, repoName)
            return new NormalizedResponseDTO(repository)
        } catch (e) {
            return new NormalizedResponseDTO(null)
        }
    }

    @Get('/:repoName/:branch/tree')
    @ApiOperation({
        summary: `Explore a repository tree`,
        description: `Get the tree of a specific repository`,
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
    async getRepoTree(
        @CurrentToken() token: Token,
        @Param('repoName') repoName: string,
        @Param('branch') branch: string,
    ): Promise<NormalizedResponseDTO<GithubFileHash[]>> {
        try {
            const user: User = await this.usersService.getUserById(token.id)
            const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
            if (!userAccount) {
                throw new PreconditionFailedException('User does not have a github account')
            }
            const tree = await this.githubReposService.getRepoTree(userAccount.accessToken, userAccount.username, repoName, branch)
            return new NormalizedResponseDTO(tree)
        } catch (e) {
            console.log(e)
            return new NormalizedResponseDTO(null)
        }
    }

    @Get('/user/emails/:accessToken')
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
        type: GithubEmail,
        isArray: true,
    })
    @Permission([GithubRepoPermissionsEnum.READ])
    async getUserEmailsByAccessToken(@Param('accessToken') accessToken: string): Promise<NormalizedResponseDTO<GithubEmail[]>> {
        const email = await this.githubReposService.getEmailsByAccessToken(accessToken)
        return new NormalizedResponseDTO(email)
    }

    @Get('/user/access-token/:accessToken')
    @ApiOperation({
        summary: `Get github user info by access token`,
        description: `Get data about the git provider account that was linked with the requesting user account.`,
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
    async getUserByAccessToken(@Param('accessToken') accessToken: string): Promise<NormalizedResponseDTO<any>> {
        const user = await this.githubReposService.getUserByAccessToken(accessToken)
        return new NormalizedResponseDTO(user)
    }
}
