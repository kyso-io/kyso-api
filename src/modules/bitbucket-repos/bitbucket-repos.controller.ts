import { BitbucketRepoPermissionsEnum, GithubFileHash, GithubRepository, LoginProviderEnum, NormalizedResponseDTO, Repository, Token, User, UserAccount } from '@kyso-io/kyso-model';
import { Controller, Get, Logger, Param, PreconditionFailedException, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Autowired } from '../../decorators/autowired';
import { GenericController } from '../../generic/controller.generic';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { Permission } from '../auth/annotations/permission.decorator';
import { UsersService } from '../users/users.service';
import { BitbucketReposProvider } from './providers/bitbucket-repo.provider';

@ApiTags('repos/bitbucket')
@Controller('repos/bitbucket')
export class BitbucketReposController extends GenericController<Repository> {
  @Autowired({ typeName: 'UsersService' })
  private usersService: UsersService;

  constructor(private readonly bitbucketReposProvider: BitbucketReposProvider) {
    super();
  }

  assignReferences(repo: Repository) {
    return repo;
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
  @Permission([BitbucketRepoPermissionsEnum.READ])
  async getRepos(@CurrentToken() token: Token, @Query('filter') filter, @Query('page') page, @Query('per_page') perPage): Promise<NormalizedResponseDTO<GithubRepository[]>> {
    const user: User = await this.usersService.getUserById(token.id);
    const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.BITBUCKET);
    if (!userAccount) {
      throw new PreconditionFailedException('User does not have a bitbucket account');
    }
    const data: any = await this.bitbucketReposProvider.getWorkspaces(userAccount.accessToken, 1, 100);
    let workspaces: string[] = [];
    if (data?.values && Array.isArray(data.values) && data.values.length > 0) {
      workspaces = data.values.map((workspace: any) => workspace.slug);
    }
    const repos: GithubRepository[] = await Promise.all(workspaces.map((workspace: string) => this.bitbucketReposProvider.searchRepos(userAccount.accessToken, workspace, filter, page, perPage)));
    return new NormalizedResponseDTO(repos.flat());
  }

  @Get('/user')
  @ApiOperation({
    summary: `Get data about the git provider account that was linked with the requesting user account.`,
  })
  @ApiResponse({
    status: 200,
    description: `The data of the specified repository`,
  })
  @Permission([BitbucketRepoPermissionsEnum.READ])
  async getAuthenticatedUser(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<any>> {
    try {
      const user: User = await this.usersService.getUserById(token.id);
      const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.BITBUCKET);
      if (!userAccount) {
        throw new PreconditionFailedException('User does not have a bitbucket account');
      }
      const bitbucketAccount: any = await this.bitbucketReposProvider.getUser(userAccount.accessToken);
      return new NormalizedResponseDTO(bitbucketAccount);
    } catch (e) {
      Logger.error(e);
      return new NormalizedResponseDTO(null);
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
  @Permission([BitbucketRepoPermissionsEnum.READ])
  async getRepo(@CurrentToken() token: Token, @Query('name') name: string): Promise<NormalizedResponseDTO<GithubRepository>> {
    try {
      if (!name || name.length === 0) {
        throw new PreconditionFailedException('Repository name is required');
      }
      const user: User = await this.usersService.getUserById(token.id);
      const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.BITBUCKET);
      if (!userAccount) {
        throw new PreconditionFailedException('User does not have a bitbucket account');
      }
      const repository: GithubRepository = await this.bitbucketReposProvider.getRepository(userAccount.accessToken, name);
      return new NormalizedResponseDTO(repository);
    } catch (e) {
      Logger.error(e);
      return new NormalizedResponseDTO(null);
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
  @Permission([BitbucketRepoPermissionsEnum.READ])
  async getRepoTree(
    @CurrentToken() token: Token,
    @Param('branch') branch: string,
    @Query('name') name: string,
    @Param('path') path: string,
  ): Promise<NormalizedResponseDTO<{ nextPageCode: string; data: GithubFileHash[] }>> {
    try {
      if (!name || name.length === 0) {
        throw new PreconditionFailedException('Repository name is required');
      }
      const user: User = await this.usersService.getUserById(token.id);
      const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.BITBUCKET);
      if (!userAccount) {
        throw new PreconditionFailedException('User does not have a bitbucket account');
      }
      const tree: { nextPageCode: string; data: GithubFileHash[] } = await this.bitbucketReposProvider.getRootFilesAndFoldersByCommit(userAccount.accessToken, name, branch, path, null);
      return new NormalizedResponseDTO(tree);
    } catch (e) {
      Logger.error(e);
      return new NormalizedResponseDTO(null);
    }
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
  async getUserByAccessToken(@Param('accessToken') accessToken: string): Promise<NormalizedResponseDTO<any>> {
    const user = await this.bitbucketReposProvider.getUser(accessToken);
    return new NormalizedResponseDTO(user);
  }
}
