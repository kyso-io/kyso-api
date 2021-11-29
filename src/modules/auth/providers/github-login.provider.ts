import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from 'src/modules/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedError } from 'src/helpers/errorHandling';
import { GithubReposProvider } from 'src/modules/github-repos/providers/github-repo.provider';
import { User } from 'src/model/user.model';
import { GithubReposService } from 'src/modules/github-repos/github-repos.service';
import { access } from 'fs';

const axios = require('axios').default;

@Injectable()
export class GithubLoginProvider {
  constructor(
    private readonly userService: UsersService,
    private readonly githubService: GithubReposService,
    private readonly jwtService: JwtService,
  ) {}
  // FLOW:
  //     * After calling login, frontend should call to
  // https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_url=${REDIRECT}&state=${RANDOM_STRING}
  //       to get a temporary code
  //     * Then, frontend should call this method throught the API to get the final JWT
  //     * Finally, should use this JWT for the rest of the methods
  //     * The access_token will be stored in MongoDB, so the next operations could be managed as well
  async login(code: string): Promise<String> {
    const res = await axios.post(
      `https://github.com/login/oauth/access_token`,
      {
        client_id: process.env.AUTH_GITHUB_CLIENT_ID,
        client_secret: process.env.AUTH_GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: { 'content-type': 'application/json' },
      },
    );

    if (res.data.includes('error_description')) {
      // We got an error. Thanks Github for returning an error as a 200 ;)
      Logger.error(`Error getting access_token: ${res.data}`);
      throw new UnauthorizedError('');
    }

    // Retrieve the token...
    const access_token = res.data.split('&')[0].split('=')[1];

    const githubUser = await this.githubService.getUserByAccessToken(
      access_token,
    );
    const emails = await this.githubService.getEmailByAccessToken(access_token);
    const onlyPrimaryMail = emails.filter((x) => x.primary === true)[0];

    const user = User.fromGithubUser(githubUser, onlyPrimaryMail);

    // Get user's detail
    // Check if the user exists in database, and if not, create it
    let userInDb = null;
    try {
      let userInDb = await this.userService.getUser({
        filter: { email: user.email },
      });
    } catch (ex) {
      Logger.log(`User ${user.username} does not exist at Kyso, creating it`);
    }

    if (userInDb) {
      // User exists, update accessToken
      userInDb.accessToken = access_token;
    } else {
      // User does not exists, create it
    }

    // In any case, generate JWT Token here
    // generate token
    const token = this.jwtService.sign(
      {
        username: user.username,
        nickname: user.nickname,
        // plan: user.plan,
        id: userInDb.id,
        email: user.email,
        // TODO: USE PERMISSION SYSTEM ;)
        teams: [
          {
            name: 'Team Name',
            permissions: ['READ_REPORTS', 'READ_COMMENTS'],
          },
        ],
      },
      {
        expiresIn: '2h',
        issuer: 'kyso',
      },
    );

    return token;
  }
}
