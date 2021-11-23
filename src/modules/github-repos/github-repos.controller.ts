import { Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GenericController } from 'src/generic/controller.generic';
import { HateoasLinker } from 'src/helpers/hateoasLinker';
import { Repository } from 'src/model/repository.model';
import { GithubReposService } from 'src/modules/github-repos/github-repos.service';
import { GithubAccount } from './model/github-account.model';

@ApiTags('repos/github')
@Controller('repos/github')
export class GithubReposController extends GenericController<Repository> {
    constructor(private readonly reposService: GithubReposService) {
        super();
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
        summary: `By passing in the appropriate options, you can search for available repositories in the linked git provider account`
    })
    @ApiResponse({ status: 200, description: `Search results matching criteria`, type: Repository})
    async getRepos(@Query("filter") filter, @Query("page") page, @Query("per_page") perPage, @Req() req) {
        // LOGIN??

        const repos = await this.reposService.getRepos({
          user: req.user,
          filter,
          page,
          perPage
        })
    
        repos.forEach( x => this.assignReferences(x))
    
        return repos
      }
    
    @Get("/:repoOwner/:repoName")
    @ApiOperation({
        summary: `Fetch data for a repository, after specifying the owner and the name of the repository`
    })
    @ApiResponse({ status: 200, description: `The data of the specified repository`, type: Repository})
    async getRepo(
        @Param('repoOwner') repoOwner: string,
        @Param("repoName") repoName: string,
        @Req() req) {
        // LOGIN??
        
        const repo = await req.reposService.getRepo(req.user, repoOwner, repoName)
        this.assignReferences(repo)

        return repo
    }
    
    @Get("/:repoOwner/:repoName/:branch/tree")
    @ApiOperation({
        summary: `Get the tree of a specific repository`
    })
    @ApiResponse({ status: 200, description: `The data of the specified repository`, type: Repository})
    async getRepoTree(
        @Param('repoOwner') repoOwner: string,
        @Param("repoName") repoName: string,
        @Param("branch") branch: string,
        @Req() req) {
        
        // LOGIN??

        const tree = await req.reposService.getRepoTree(repoOwner, repoName, branch)
    
        return tree
    }
    
    @Get("/user")
    @ApiOperation({
        summary: `Get data about the git provider account that was linked with the requesting user account.`
    })
    @ApiResponse({ status: 200, description: `The data of the specified repository`, type: GithubAccount})
    async getAuthenticatedUser() {
        // LOGIN??
        
        const user = await this.reposService.getUser()
    
        return user
    }
}
