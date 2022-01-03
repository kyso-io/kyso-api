import { Injectable, Scope } from '@nestjs/common'
import { NotFoundError } from '../../../helpers/errorHandling'
const axios = require('axios').default

const repoMapFunction = (repo) => ({
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

@Injectable({ scope: Scope.REQUEST })
export class BitbucketReposProvider {
    authenticationMethod: string
    authorizationHeader: string

    constructor() {}

    async withUserAndAppPassword(username, appPassword) {
        this.authenticationMethod = 'basic-username-app-password'
        // build basic authentication
        let buffer = Buffer.from(`${username}:${appPassword}`)
        this.authorizationHeader = `Basic ${buffer.toString('base64')}`
    }

    async getRepos(workspace, page, perPage) {
        let res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${workspace}?page=${page}&pagelen=${perPage}`, {
            headers: { Authorization: this.authorizationHeader },
        })

        return res.data.values.map(repoMapFunction)
    }

    async getAllRepos() {
        let page = 1
        let workspaces
        let result = []

        do {
            workspaces = await this.getWorkspaces(page, DEFAULT_PER_PAGE)

            let paginatedResponse

            for (let workspace of workspaces.values) {
                let repositoryPage = 1
                do {
                    paginatedResponse = await this.getRepos(workspace.slug, repositoryPage, DEFAULT_PER_PAGE)

                    repositoryPage++
                    result = [...result, ...paginatedResponse]
                } while (paginatedResponse.length > 0)
            }

            page++
        } while (workspaces.next)

        return result
    }

    async getWorkspaces(page, perPage) {
        const res = await axios.get(`${process.env.BITBUCKET_API}/workspaces?page=${page}&pagelen=${perPage}`, {
            headers: { Authorization: this.authorizationHeader },
        })

        return res.data
    }

    async getRepo(workspace, name) {
        const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${workspace}/${name}`, {
            headers: { Authorization: this.authorizationHeader },
        })

        return repoMapFunction(res.data)
    }

    async searchRepos(filter, workspace, page, perPage) {
        const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${workspace}?q=${filter}&page=${page}&pagelen=${perPage}`, {
            headers: { Authorization: this.authorizationHeader },
        })

        return res.data.values.map(repoMapFunction)
    }

    async getBranches(workspace, repo, page, perPage) {
        const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${workspace}/${repo}/refs/branches?page=${page}&pagelen=${perPage}`, {
            headers: { Authorization: this.authorizationHeader },
        })

        return res.data.values.map((branch) => ({
            name: branch.name,
            commit: branch.target.hash,
        }))
    }

    async getCommits(workspace, repo, branch, page, perPage) {
        const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${workspace}/${repo}/commits/${branch}?page=${page}&pagelen=${perPage}`, {
            headers: { Authorization: this.authorizationHeader },
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

    extractEmailFromText(text) {
        return text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi)
    }

    async getRootFilesAndFolders(workspace, repo, pageCode) {
        return this.getRootFilesAndFoldersByCommit(workspace, repo, null, pageCode)
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
    async getRootFilesAndFoldersByCommit(workspace, repo, commit, pageCode) {
        let requestUrl = `${process.env.BITBUCKET_API}/repositories/${workspace}/${repo}/src/`

        if (commit) {
            requestUrl = requestUrl + `${commit}/`
        }

        if (pageCode) {
            requestUrl = requestUrl + `?page=${pageCode}`
        }

        // The last slash (/) is important, without it... does not works...
        let res = await axios.get(requestUrl, {
            headers: { Authorization: this.authorizationHeader },
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

    async getFileContent(workspace, repo, commit, filePath) {
        try {
            const res = await axios.get(`${process.env.BITBUCKET_API}/repositories/${workspace}/${repo}/src/${commit}/${filePath}`, {
                headers: { Authorization: this.authorizationHeader },
            })

            return Buffer.from(res.data).toString('base64')
        } catch (err) {
            if (err.status === 404) {
                throw new NotFoundError({
                    message: "The resource you are trying to access can't be found or isn't a file.",
                })
            }
            throw err
        }
    }

    async getUser() {
        const res = await axios.get(`${process.env.BITBUCKET_API}/user`, {
            headers: { Authorization: this.authorizationHeader },
        })

        return res.data
    }
}
