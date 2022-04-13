import { GithubRepository } from '@kyso-io/kyso-model'
import { Injectable } from '@nestjs/common'
import { Autowired } from '../../../decorators/autowired'
import { KysoSettingsEnum } from "@kyso-io/kyso-model"
import { KysoSettingsService } from '../../kyso-settings/kyso-settings.service'
import { CreateBitbucketWebhookDto } from '../classes/create-bitbucket-webhook.dto'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios').default

const repoMapFunction = (repo: any): GithubRepository => ({
    id: repo.uuid,
    owner: repo.owner.display_name ? repo.owner.display_name : '',
    name: repo.full_name,
    fullName: repo.name,
    defaultBranch: repo.mainbranch.name,
    description: repo.description,
    isPrivate: repo.is_private,
    language: repo.language,
    pushedAt: repo.updated_on,
})

const DEFAULT_PER_PAGE = 20

@Injectable()
export class BitbucketReposProvider {
    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService
    
    private async getRepos(accessToken: string, workspace: string, page: number, perPage: number): Promise<any[]> {
        const bitbucketApi = await this.kysoSettingsService.getValue(KysoSettingsEnum.BITBUCKET_API)
        
        const res = await axios.get(`${bitbucketApi}/repositories/${workspace}?page=${page}&pagelen=${perPage}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        return res.data.values.map(repoMapFunction)
    }

    public async getAllRepos(accessToken: string): Promise<any[]> {
        let page = 1
        let workspaces = null
        let result = []
        do {
            workspaces = await this.getWorkspaces(accessToken, page, DEFAULT_PER_PAGE)
            let paginatedResponse = null
            for (const workspace of workspaces.values) {
                let repositoryPage = 1
                do {
                    paginatedResponse = await this.getRepos(accessToken, workspace.slug, repositoryPage, DEFAULT_PER_PAGE)
                    repositoryPage++
                    result = [...result, ...paginatedResponse]
                } while (paginatedResponse.length > 0)
            }
            page++
        } while (workspaces.next)
        return result
    }

    public async getWorkspaces(accessToken: string, page: number, perPage: number): Promise<any> {
        const bitbucketApi = await this.kysoSettingsService.getValue(KysoSettingsEnum.BITBUCKET_API)
        const res = await axios.get(`${bitbucketApi}/workspaces?page=${page}&pagelen=${perPage}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        return res.data
    }

    public async getRepository(accessToken: string, fullName: string): Promise<any> {
        const bitbucketApi = await this.kysoSettingsService.getValue(KysoSettingsEnum.BITBUCKET_API)
        const res = await axios.get(`${bitbucketApi}/repositories/${fullName}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        return repoMapFunction(res.data)
    }

    // https://developer.atlassian.com/cloud/bitbucket/rest/intro/#filtering
    public async searchRepos(accessToken: string, workspace: string, filter: string, page: number, perPage: number): Promise<any> {
        const bitbucketApi = await this.kysoSettingsService.getValue(KysoSettingsEnum.BITBUCKET_API)
        let url = `${bitbucketApi}/repositories/${workspace}?`
        if (filter) {
            url += `q=name="${filter}"`
        }
        if (page) {
            url += `&page=${page}`
        }
        if (perPage) {
            url += `&pagelen=${perPage}`
        }
        const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        return res.data.values.map(repoMapFunction)
    }

    // public async getBranches(accessToken: string, fullName: string, page: number, perPage: number): Promise<any> {
    public async getBranches(accessToken: string, fullName: string): Promise<any> {
        const bitbucketApi = await this.kysoSettingsService.getValue(KysoSettingsEnum.BITBUCKET_API)
        const res = await axios.get(`${bitbucketApi}/repositories/${fullName}/refs/branches`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        return res.data.values.map((branch) => ({
            name: branch.name,
            commit: branch.target.hash,
        }))
    }

    // public async getCommits(accessToken: string, fullName: string, branch: string, page: number, perPage: number): Promise<any> {
    public async getCommits(accessToken: string, fullName: string, branch: string): Promise<any> {
        // const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${fullName}/commits/${branch}?page=${page}&pagelen=${perPage}`, {
        const bitbucketApi = await this.kysoSettingsService.getValue(KysoSettingsEnum.BITBUCKET_API)
        const res = await axios.get(`${bitbucketApi}/repositories/${fullName}/commits/${branch}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        return res.data.values.map((elem) => ({
            sha: elem.hash,
            author: {
                name: elem.author.user.display_name,
                email: this.extractEmailFromText(elem.author.raw)[0] ? this.extractEmailFromText(elem.author.raw)[0] : '',
            },
            date: elem.date,
            message: elem.message,
            htmlUrl: elem.links.html.href,
        }))
    }

    public extractEmailFromText(text: string): RegExpMatchArray | null {
        return text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi)
    }

    public async getRootFilesAndFolders(accessToken: string, fullName: string): Promise<any> {
        return this.getRootFilesAndFoldersByCommit(accessToken, fullName, null, null, null)
    }

    /**
     * Retrieves all the files and folders
     * @param {*} workspace Workspace internal name
     * @param {*} repo   Repository internal name (repo-slug in bitbucket terminology)
     * @param {*} commit Commit sha to retrieve the files. If you want the files of a branch, then you should search
     *                   first the last commit of that branch, and then ask by the commit sha...
     * @param {*} pageCode This API works differently regarding the others. The next pages are returned in the response
     *                     as a code, and not as an incremental number.
     * @returns
     */
    public async getRootFilesAndFoldersByCommit(accessToken: string, fullName: string, commit: string, folder: string, pageCode: number): Promise<any> {
        const bitbucketApi = await this.kysoSettingsService.getValue(KysoSettingsEnum.BITBUCKET_API)
        let requestUrl = `${bitbucketApi}/repositories/${fullName}/src/`
        if (commit) {
            requestUrl = requestUrl + `${commit}/`
        }
        let fileName = null
        if (folder && folder.length > 0) {
            const directories: string[] = folder.split('/')
            if (directories.length === 1 && directories[0].includes('.')) {
                fileName = directories[directories.length - 1]
            } else if (directories[directories.length - 1].includes('.')) {
                requestUrl = requestUrl + `${directories.slice(0, directories.length - 1).join('/')}/`
                fileName = directories[directories.length - 1]
            } else {
                requestUrl = requestUrl + `${folder}/`
            }
        }
        if (pageCode) {
            requestUrl = requestUrl + `?page=${pageCode}`
        }
        // The last slash (/) is important, without it... does not works...
        const res = await axios.get(requestUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        const filterData = (obj) => ({
            type: obj.type === 'commit_dir' ? 'dir' : 'file',
            path: obj.path,
            hash: obj.commit.hash,
            htmlUrl: obj.links.self.href,
        })
        let nextPageCode = null
        if (res.data.next) {
            nextPageCode = res.data.next.split('?page=')[1]
        }
        let result = res.data.values
        if (fileName) {
            result = result.filter((obj) => obj.path.endsWith(fileName))
        }
        return {
            nextPageCode: nextPageCode,
            data: result.map(filterData),
        }
    }

    public async getFileContent(accessToken: string, fullName: string, commit: string, filePath: string): Promise<any> {
        const bitbucketApi = await this.kysoSettingsService.getValue(KysoSettingsEnum.BITBUCKET_API)
        const res = await axios.get(`${bitbucketApi}/repositories/${fullName}/src/${commit}/${filePath}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            transformResponse: [(data) => data],
        })
        return Buffer.from(res.data, 'utf-8')
    }

    public async getUser(accessToken: string): Promise<any> {
        const bitbucketApi = await this.kysoSettingsService.getValue(KysoSettingsEnum.BITBUCKET_API)
        const res = await axios.get(`${bitbucketApi}/user`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        return res.data
    }

    public async downloadRepository(accessToken: string, fullName: string, commit: string): Promise<Buffer> {
        const res = await axios.get(`https://bitbucket.org/${fullName}/get/${commit}.zip`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            responseType: 'arraybuffer',
        })
        return res.data
    }

    public async getWebhooks(accessToken: string, fullName: string): Promise<void> {
        const bitbucketApi = await this.kysoSettingsService.getValue(KysoSettingsEnum.BITBUCKET_API)
        const res = await axios.get(`${bitbucketApi}/repositories/${fullName}/hooks`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        return res.data
    }

    public async createWebhook(accessToken: string, fullName: string, data: CreateBitbucketWebhookDto): Promise<void> {
        const bitbucketApi = await this.kysoSettingsService.getValue(KysoSettingsEnum.BITBUCKET_API)
        const res = await axios.post(`${bitbucketApi}/repositories/${fullName}/hooks`, data, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        return res.data
    }

    public async deleteWebhook(accessToken: string, fullName: string, hookId: number): Promise<void> {
        const bitbucketApi = await this.kysoSettingsService.getValue(KysoSettingsEnum.BITBUCKET_API)
        const res = await axios.delete(`${bitbucketApi}/repositories/${fullName}/hooks/${hookId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        return res.data
    }

    public async login(code: string): Promise<any> {
        const clientId = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_BITBUCKET_CLIENT_ID)
        const clientSecret = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_BITBUCKET_CLIENT_SECRET)
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
        })
        const res = await axios.post(`https://bitbucket.org/site/oauth2/access_token`, params.toString(), {
            auth: {
                username: clientId,
                password: clientSecret,
            },
        })
        return res.data
    }

    public async refreshToken(refresh_token: string): Promise<any> {
        const clientId = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_BITBUCKET_CLIENT_ID)
        const clientSecret = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_BITBUCKET_CLIENT_SECRET)
        
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token,
        })
        const res = await axios.post(`https://bitbucket.org/site/oauth2/access_token`, params.toString(), {
            auth: {
                username: clientId,
                password: clientSecret,
            },
        })
        return res.data
    }
}
