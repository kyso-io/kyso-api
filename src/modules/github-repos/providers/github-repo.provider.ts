import { GithubBranch, GithubCommit, GithubEmail, GithubFileHash, GithubRepository } from '@kyso-io/kyso-model';
import { Injectable } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import axios from 'axios';
import * as moment from 'moment';
import { NotFoundError } from '../../../helpers/errorHandling';

const MAX_ORGANIZATIONS_PER_USER = 100;

const repoMapFunction = (repo: any): GithubRepository => ({
  id: repo.id,
  owner: repo.owner.login,
  name: repo.name,
  fullName: repo.full_name,
  defaultBranch: repo.default_branch,
  description: repo.description,
  isPrivate: repo.private,
  language: repo.language,
  pushedAt: repo.pushed_at,
});

@Injectable()
export class GithubReposProvider {
  async getRepos(accessToken: string, page, perPage) {
    const octokit: Octokit = new Octokit({
      auth: `token ${accessToken}`,
    });
    const res = await octokit.repos.listForAuthenticatedUser({
      per_page: perPage,
      page,
    });
    return res.data.map(repoMapFunction);
  }

  public async getRepository(accessToken: string, githubUsername: string, repositoryName: string): Promise<GithubRepository> {
    const octokit: Octokit = new Octokit({
      auth: `token ${accessToken}`,
    });
    const response: any = await octokit.repos.get({
      owner: githubUsername,
      repo: repositoryName,
    });
    return repoMapFunction(response.data);
  }

  async searchRepos(accessToken: string, filter, page, perPage) {
    const [user, orgs] = await Promise.all([this.getUser(accessToken), this.getOrganizations(accessToken)]);
    let q = `${filter} in:name+fork:true+user:${user.login}`;
    if (orgs) {
      orgs.forEach((org) => {
        q += `+org:${org.login}`;
      });
    }
    const octokit: Octokit = new Octokit({
      auth: `token ${accessToken}`,
    });
    const res = await octokit.search.repos({
      q,
      per_page: perPage,
      page,
    });
    return res.data.items.map(repoMapFunction);
  }

  public async getBranches(accessToken: string, githubUsername: string, repositoryName: string): Promise<GithubBranch[]> {
    const octokit: Octokit = new Octokit({
      auth: `token ${accessToken}`,
    });
    const res = await octokit.repos.listBranches({
      owner: githubUsername,
      repo: repositoryName,
    });
    return res.data.map((branch) => ({
      name: branch.name,
      commit: branch.commit.sha,
      is_default: false,
    }));
  }

  public async getCommits(accessToken: string, githubUsername: string, repositoryName: string, branch: string): Promise<GithubCommit[]> {
    const octokit: Octokit = new Octokit({
      auth: `token ${accessToken}`,
    });
    const res = await octokit.repos.listCommits({
      owner: githubUsername,
      repo: repositoryName,
      sha: branch,
    });
    return res.data.map((elem) => ({
      sha: elem.sha,
      author: {
        name: elem.commit.author.name,
        email: elem.commit.author.email,
      },
      date: moment(elem.commit.author.date).toDate(),
      message: elem.commit.message,
      htmlUrl: elem.html_url.replace(/\/commit\//, '/tree/'),
    }));
  }

  public async getFileHash(accessToken: string, filePath: string, owner: string, repo: string, branch: string): Promise<GithubFileHash | GithubFileHash[]> {
    /* Github API will throw a 403 error when trying to get the hash of a file bigger than 1 MB.
        To work around this, we launch two request simultaneously, one for the filePath specified and
        one for the folder were the requested file is located. If we catch a 403 error on the first
        request, we check the second one. */

    const sanitizedPath = filePath && filePath.length ? filePath.replace('./', '').replace(/\/$/, '') : '';
    const octokit: Octokit = new Octokit({
      auth: `token ${accessToken}`,
    });

    let res;
    try {
      res = await octokit.repos.getContent({
        owner,
        repo,
        path: sanitizedPath,
        ref: branch,
      });
    } catch (err) {
      if (err.status === 403) {
        try {
          const newPath = filePath.substr(0, filePath.lastIndexOf('/'));
          res = await octokit.repos.getContent({
            owner,
            repo,
            path: newPath,
            ref: branch,
          });
          res.data = res.data.find((elem) => elem.path === filePath);
        } catch (e) {
          throw err;
        }
      } else throw err;
    }

    const filterData = (obj) => ({
      type: obj.type,
      path: obj.path,
      hash: obj.sha,
      htmlUrl: obj.html_url,
    });
    return res.data.sha ? [filterData(res.data)] : res.data.map(filterData);
  }

  async getFileContent(accessToken: string, fileSha: string, owner: string, repo: string) {
    try {
      const octokit: Octokit = new Octokit({
        auth: `token ${accessToken}`,
      });
      const res = await octokit.git.getBlob({
        owner,
        repo,
        file_sha: fileSha.toLowerCase(),
      });
      return Buffer.from(res.data.content, 'base64');
    } catch (err) {
      if (err.status === 404) {
        throw new NotFoundError({
          message: "The resource you are trying to access can't be found or isn't a file.",
        });
      }
      throw err;
    }
  }

  async getUser(accessToken: string) {
    const octokit: Octokit = new Octokit({
      auth: `token ${accessToken}`,
    });
    const res = await octokit.users.getAuthenticated();
    return res.data;
  }

  async getUserByAccessToken(access_token: string) {
    const res = await axios.get(`https://api.github.com/user`, {
      headers: {
        Authorization: `token ${access_token}`,
        'content-type': 'application/json',
      },
    });

    return res.data;
  }

  async getEmailsByAccessToken(access_token: string): Promise<GithubEmail[]> {
    const res = await axios.get(`https://api.github.com/user/emails`, {
      headers: {
        Authorization: `token ${access_token}`,
        'content-type': 'application/json',
      },
    });
    return res.data;
  }

  async getOrganizations(accessToken: string) {
    const octokit: Octokit = new Octokit({
      auth: `token ${accessToken}`,
    });
    const res = await octokit.orgs.listForAuthenticatedUser({
      per_page: MAX_ORGANIZATIONS_PER_USER,
    });
    return res.data;
  }
}
