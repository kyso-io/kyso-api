import { GithubRepository } from '@kyso-io/kyso-model'
import { Injectable } from '@nestjs/common'
import { NotFoundError } from '../../../helpers/errorHandling'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios').default

const repoMapFunction = (repo: any): GithubRepository => ({
    id: repo.uuid,
    owner: repo.owner.display_name ? repo.owner.display_name : '',
    name: repo.name,
    fullName: repo.full_name,
    defaultBranch: repo.mainbranch.name,
    description: repo.description,
    isPrivate: repo.is_private,
    language: repo.language,
    pushedAt: repo.updated_on,
})

const DEFAULT_PER_PAGE = 20

@Injectable()
export class BitbucketReposProvider {
    constructor() {
        // const username = 'dani-kyso'
        // const password = 'D6GjpNwngz9A3t7XjZwq'
        // this.getWorkspaces(username, password, 1, DEFAULT_PER_PAGE)
        //     .then((res) => console.log(res))
        //     .catch((err) => console.log(err))
        // this.getAllRepos(username, password)
        //     .then((result) => console.log(result))
        //     .catch((err) => console.log(err))
        // this.getRepo(username, password, 'dani-kyso/dummy-project')
        //     .then((result) => console.log(result))
        //     .catch((err) => console.log(err))
        // this.searchRepos(username, password, 'dani-kyso', 'name~"dummy"', 1, DEFAULT_PER_PAGE)
        //     .then((result) => console.log(result))
        //     .catch((err) => console.log(err))
        // this.getBranches(username, password, 'dani-kyso/dummy-project', 1, DEFAULT_PER_PAGE)
        //     .then((result) => console.log(result))
        //     .catch((err) => console.log(err))
        // this.getCommits(username, password, 'dani-kyso/dummy-project', 'master', 1, DEFAULT_PER_PAGE)
        //     .then((result) => console.log(result))
        //     .catch((err) => console.log(err))
        // this.getRootFilesAndFolders(username, password, 'dani-kyso/dummy-project')
        //     .then((result) => console.log(result))
        //     .catch((err) => console.log(err))
        // this.getRootFilesAndFoldersByCommit(username, password, 'dani-kyso/dummy-project', '7aac65f1606c246ee074bb9a579cf737f3288e95', 'data/skus', null)
        //     .then((result) => console.log(result))
        //     .catch((err) => console.log(err))
        // this.getFileContent(username, password, 'dani-kyso/dummy-project', '7aac65f1606c246ee074bb9a579cf737f3288e95', 'index.js')
        //     .then((result) => console.log(Buffer.from(result).toString()))
        //     .catch((err) => console.log(err))
        // this.getUser(username, password)
        //     .then((result) => console.log(result))
        //     .catch((err) => console.log(err))
    }

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

    public async getRepo(username: string, password: string, fullName: string): Promise<any> {
        const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${fullName}`, {
            headers: { Authorization: this.withUserAndAppPassword(username, password) },
        })
        return repoMapFunction(res.data)
    }

    // https://developer.atlassian.com/cloud/bitbucket/rest/intro/#filtering
    public async searchRepos(username: string, password: string, workspace: string, filter: string, page: number, perPage: number): Promise<any> {
        let url = `${process.env.BITBUCKET_API}/repositories/${workspace}?`
        if (filter) {
            url += `q=${filter}`
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

    public async getBranches(username: string, password: string, fullName: string, page: number, perPage: number): Promise<any> {
        const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${fullName}/refs/branches?page=${page}&pagelen=${perPage}`, {
            headers: { Authorization: this.withUserAndAppPassword(username, password) },
        })
        return res.data.values.map((branch) => ({
            name: branch.name,
            commit: branch.target.hash,
        }))
    }

    public async getCommits(username: string, password: string, fullName: string, branch: string, page: number, perPage: number): Promise<any> {
        const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${fullName}/commits/${branch}?page=${page}&pagelen=${perPage}`, {
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
        if (folder && folder.length > 0) {
            requestUrl = requestUrl + `${folder}/`
        }
        if (pageCode) {
            requestUrl = requestUrl + `?page=${pageCode}`
        }
        // The last slash (/) is important, without it... does not works...
        const res = await axios.get(requestUrl, {
            headers: { Authorization: this.withUserAndAppPassword(username, password) },
        })
        const filterData = (obj) => ({
            type: obj.type,
            path: obj.path,
            hash: obj.commit.hash,
            htmlUrl: obj.links.self.href,
        })
        let nextPageCode = null
        if (res.data.next) {
            nextPageCode = res.data.next.split('?page=')[1]
        }
        return {
            nextPageCode: nextPageCode,
            data: res.data.values.map(filterData),
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
}
