import { GithubRepository } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { NotFoundError } from '../../../helpers/errorHandling'
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
    private withUserAndAppPassword(username: string, appPassword: string): string {
        const buffer = Buffer.from(`${username}:${appPassword}`)
        return `Basic ${buffer.toString('base64')}`
    }

    private async getRepos(username: string, password: string, workspace: string, page: number, perPage: number): Promise<any[]> {
        const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${workspace}?page=${page}&pagelen=${perPage}`, {
            headers: { Authorization: this.withUserAndAppPassword(username, password) },
        })
        return res.data.values.map(repoMapFunction)
    }

    public async getAllRepos(username: string, password: string): Promise<any[]> {
        let page = 1
        let workspaces = null
        let result = []
        do {
            workspaces = await this.getWorkspaces(username, password, page, DEFAULT_PER_PAGE)
            let paginatedResponse = null
            for (const workspace of workspaces.values) {
                let repositoryPage = 1
                do {
                    paginatedResponse = await this.getRepos(username, password, workspace.slug, repositoryPage, DEFAULT_PER_PAGE)
                    repositoryPage++
                    result = [...result, ...paginatedResponse]
                } while (paginatedResponse.length > 0)
            }
            page++
        } while (workspaces.next)
        return result
    }

    public async getWorkspaces(username: string, password: string, page: number, perPage: number): Promise<any> {
        const res = await axios.get(`${process.env.BITBUCKET_API}/workspaces?page=${page}&pagelen=${perPage}`, {
            headers: { Authorization: this.withUserAndAppPassword(username, password) },
        })
        return res.data
    }

    public async getRepository(username: string, password: string, fullName: string): Promise<any> {
        const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${fullName}`, {
            headers: { Authorization: this.withUserAndAppPassword(username, password) },
        })
        return repoMapFunction(res.data)
    }

    // https://developer.atlassian.com/cloud/bitbucket/rest/intro/#filtering
    public async searchRepos(username: string, password: string, workspace: string, filter: string, page: number, perPage: number): Promise<any> {
        let url = `${process.env.BITBUCKET_API}/repositories/${workspace}?`
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
            headers: { Authorization: this.withUserAndAppPassword(username, password) },
        })
        return res.data.values.map(repoMapFunction)
    }

    // public async getBranches(username: string, password: string, fullName: string, page: number, perPage: number): Promise<any> {
    public async getBranches(username: string, password: string, fullName: string): Promise<any> {
        // const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${fullName}/refs/branches?page=${page}&pagelen=${perPage}`, {
        const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${fullName}/refs/branches`, {
            headers: { Authorization: this.withUserAndAppPassword(username, password) },
        })
        return res.data.values.map((branch) => ({
            name: branch.name,
            commit: branch.target.hash,
        }))
    }

    // public async getCommits(username: string, password: string, fullName: string, branch: string, page: number, perPage: number): Promise<any> {
    public async getCommits(username: string, password: string, fullName: string, branch: string): Promise<any> {
        // const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${fullName}/commits/${branch}?page=${page}&pagelen=${perPage}`, {
        const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${fullName}/commits/${branch}`, {
            headers: { Authorization: this.withUserAndAppPassword(username, password) },
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

    public async getRootFilesAndFolders(username: string, password: string, fullName: string): Promise<any> {
        return this.getRootFilesAndFoldersByCommit(username, password, fullName, null, null, null)
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
    public async getRootFilesAndFoldersByCommit(
        username: string,
        password: string,
        fullName: string,
        commit: string,
        folder: string,
        pageCode: number,
    ): Promise<any> {
        let requestUrl = `${process.env.BITBUCKET_API}/repositories/${fullName}/src/`
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
            headers: { Authorization: this.withUserAndAppPassword(username, password) },
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

    public async getFileContent(username: string, password: string, fullName: string, commit: string, filePath: string): Promise<any> {
        try {
            const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${fullName}/src/${commit}/${filePath}`, {
                headers: { Authorization: this.withUserAndAppPassword(username, password) },
                transformResponse: [(data) => data],
            })
            return Buffer.from(res.data, 'utf-8')
        } catch (err) {
            console.log(err)
            if (err.status === 404) {
                throw new NotFoundError({
                    message: "The resource you are trying to access can't be found or isn't a file.",
                })
            }
            throw err
        }
    }

    public async getUser(username: string, password: string): Promise<any> {
        const res = await axios.get(`${process.env.BITBUCKET_API}/user`, {
            headers: { Authorization: this.withUserAndAppPassword(username, password) },
        })
        return res.data
    }

    public async downloadRepository(username: string, password: string, fullName: string, commit: string): Promise<Buffer> {
        try {
            const res = await axios.get(`https://bitbucket.org/${fullName}/get/${commit}.zip`, {
                headers: { Authorization: this.withUserAndAppPassword(username, password) },
                responseType: 'arraybuffer',
            })
            return res.data
        } catch (e) {
            Logger.error(`An error occurred while downloading the repo ${fullName}@${commit}`, e, BitbucketReposProvider.name)
            return null
        }
    }

    public async getWebhooks(username: string, password: string, fullName: string): Promise<void> {
        const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${fullName}/hooks`, {
            headers: { Authorization: this.withUserAndAppPassword(username, password) },
        })
        return res.data
    }

    public async createWebhook(username: string, password: string, fullName: string, data: CreateBitbucketWebhookDto): Promise<void> {
        const res = await axios.post(`${process.env.BITBUCKET_API}/repositories/${fullName}/hooks`, data, {
            headers: { Authorization: this.withUserAndAppPassword(username, password) },
        })
        return res.data
    }

    public async deleteWebhook(username: string, password: string, fullName: string, hookId: number): Promise<void> {
        const res = await axios.delete(`${process.env.BITBUCKET_API}/repositories/${fullName}/hooks/${hookId}`, {
            headers: { Authorization: this.withUserAndAppPassword(username, password) },
        })
        return res.data
    }
}
