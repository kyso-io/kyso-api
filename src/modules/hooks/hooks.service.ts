import { Injectable } from '@nestjs/common'
import { Octokit } from '@octokit/rest'

@Injectable()
export class HooksService {
    constructor() {
        // setTimeout(() => this.createHook(), 1000)
    }

    private async createHook(): Promise<any> {
        const accessToken = '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'
        const owner = 'fran-kyso'
        const repo = 'kronig-penney-exploration'
        const octokit = new Octokit({
            auth: `token ${accessToken}`,
        })
        try {
            let hookUrl = `${process.env.SELF_URL}/v1/hooks/github`
            if (process.env.NODE_ENV === 'development') {
                hookUrl = 'https://smee.io/kyso-github-hook-test'
            }
            const githubWeekHooks = await octokit.repos.listWebhooks({
                owner,
                repo,
            })
            // Check if hook already exists
            let githubWebHook = githubWeekHooks.data.find((element) => element.config.url === hookUrl)
            if (!githubWebHook) {
                // Create hook
                const resultCreateWebHook = await octokit.repos.createWebhook({
                    owner,
                    repo,
                    name: 'web',
                    config: {
                        url: hookUrl,
                        content_type: 'json',
                    },
                    events: ['push'],
                    active: true,
                })
                githubWebHook = resultCreateWebHook.data
                console.log('Hook created', githubWebHook.id)
            } else {
                console.log('Hook already exists', githubWebHook.id)
            }
        } catch (e) {
            console.log(e)
            // TODO: eliminar report
        }
    }
}
