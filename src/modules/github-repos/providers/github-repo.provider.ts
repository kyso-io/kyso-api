import { Injectable } from '@nestjs/common'
import { Octokit } from '@octokit/rest'
import axios from 'axios'
import { NotFoundError } from 'src/helpers/errorHandling'

const MAX_ORGANIZATIONS_PER_USER = 100

const repoMapFunction = (repo) => ({
    id: repo.id,
    owner: repo.owner.login,
    name: repo.name,
    fullName: repo.full_name,
    defaultBranch: repo.default_branch,
    description: repo.description,
    isPrivate: repo.private,
    language: repo.language,
    pushedAt: repo.pushed_at,
})

@Injectable()
export class GithubReposProvider {
    octokit: any

    async login(accessToken) {
        this.octokit = new Octokit({
            auth: `token ${accessToken}`,
        })
    }

    async getRepos(page, perPage) {
        const res = await this.octokit.repos.listForAuthenticatedUser({
            per_page: perPage,
            page,
        })

        return res.data.map(repoMapFunction)
    }

    async getRepo(owner, name) {
        const res = await this.octokit.repos.get({
            owner,
            repo: name,
        })

        return repoMapFunction(res.data)
    }

    async searchRepos(filter, page, perPage) {
        const [user, orgs] = await Promise.all([this.getUser(), this.getOrganizations()])
        let q = `${filter} in:name+fork:true+user:${user.login}`

        if (orgs) {
            orgs.forEach((org) => {
                q += `+org:${org.login}`
            })
        }

        const res = await this.octokit.search.repos({
            q,
            per_page: perPage,
            page,
        })

        return res.data.items.map(repoMapFunction)
    }

    async getBranches(owner, repo) {
        const res = await this.octokit.repos.listBranches({
            owner,
            repo,
        })

        return res.data.map((branch) => ({
            name: branch.name,
            commit: branch.commit.sha,
        }))
    }

    async getCommits(owner, repo, branch) {
        const res = await this.octokit.repos.listCommits({
            owner,
            repo,
            sha: branch,
        })

        return res.data.map((elem) => ({
            sha: elem.sha,
            author: {
                name: elem.commit.author.name,
                email: elem.commit.author.email,
            },
            date: elem.commit.author.date,
            message: elem.commit.message,
            htmlUrl: elem.html_url.replace(/\/commit\//, '/tree/'),
        }))
    }

    async getFileHash(filePath, owner, repo, branch) {
        /* Github API will throw a 403 error when trying to get the hash of a file bigger than 1 MB.
        To work around this, we launch two request simultaneously, one for the filePath specified and
        one for the folder were the requested file is located. If we catch a 403 error on the first
        request, we check the second one. */
        let res

        const sanitizedPath = filePath.length ? filePath.replace(/\/$/, '') : '.'
        const first = this.octokit.repos.getContent({
            owner,
            repo,
            path: sanitizedPath,
            ref: branch,
        })

        const newPath = filePath.substr(0, filePath.lastIndexOf('/'))
        const second = this.octokit.repos.getContent({
            owner,
            repo,
            path: newPath,
            ref: branch,
        })

        try {
            res = await first
        } catch (err) {
            if (err.status === 403) {
                res = await second
                res.data = res.data.find((elem) => elem.path === filePath)
            } else throw err
        }

        const filterData = (obj) => ({
            type: obj.type,
            path: obj.path,
            hash: obj.sha,
            htmlUrl: obj.html_url,
        })
        return res.data.sha ? filterData(res.data) : res.data.map(filterData)
    }

    async getFileContent(fileSha, owner, repo) {
        try {
            const res = await this.octokit.git.getBlob({
                owner,
                repo,
                file_sha: fileSha.toLowerCase(),
            })

            return Buffer.from(res.data.content, 'base64')
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
        const res = await this.octokit.users.getAuthenticated()

        return res.data
    }

    async getUserByAccessToken(access_token: string) {
        const res = await axios.get(`https://api.github.com/user`, {
            headers: {
                Authorization: `token ${access_token}`,
                'content-type': 'application/json',
            },
        })

        return res.data
    }

    async getEmailByAccessToken(access_token: string) {
        const res = await axios.get(`https://api.github.com/user/emails`, {
            headers: {
                Authorization: `token ${access_token}`,
                'content-type': 'application/json',
            },
        })

        return res.data
    }

    async getOrganizations() {
        const res = await this.octokit.orgs.listForAuthenticatedUser({
            per_page: MAX_ORGANIZATIONS_PER_USER,
        })

        return res.data
    }
}
