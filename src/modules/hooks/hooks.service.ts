import { Injectable } from '@nestjs/common'
// import { Octokit } from '@octokit/rest'
// import axios, { AxiosResponse } from 'axios'
// import crypto from 'crypto'
// import cryptoJS from 'crypto-js'
// import { createReadStream, createWriteStream, readFileSync } from 'fs'
// import nodeGetFolderSize from 'get-folder-size'
// import nodeGlob from 'glob'
// import { safeLoad } from 'js-yaml'
// import { join } from 'path'
// import unzipper from 'unzipper'
// import util from 'util'
// import { v4 as uuidv4 } from 'uuid'

// const glob = util.promisify(nodeGlob)

@Injectable()
export class HooksService {
    constructor() {
        // setTimeout(() => this.createGihubHook(), 1000)
    }

    // private async createGihubHook(): Promise<any> {
    //     const accessToken = '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'
    //     const owner = 'fran-kyso'
    //     const repo = 'kronig-penney-exploration'
    //     const octokit = new Octokit({
    //         auth: `token ${accessToken}`,
    //     })
    //     try {
    //         let hookUrl = `${process.env.BASE_URL}/v1/hooks/github`
    //         if (process.env.NODE_ENV === 'development') {
    //             hookUrl = 'https://smee.io/kyso-github-hook-test'
    //         }
    //         const githubWeekHooks = await octokit.repos.listWebhooks({
    //             owner,
    //             repo,
    //         })
    //         // Check if hook already exists
    //         let githubWebHook = githubWeekHooks.data.find((element) => element.config.url === hookUrl)
    //         if (!githubWebHook) {
    //             // Create hook
    //             const resultCreateWebHook = await octokit.repos.createWebhook({
    //                 owner,
    //                 repo,
    //                 name: 'web',
    //                 config: {
    //                     url: hookUrl,
    //                     content_type: 'json',
    //                 },
    //                 events: ['push'],
    //                 active: true,
    //             })
    //             githubWebHook = resultCreateWebHook.data
    //             console.log('Hook created', githubWebHook.id)
    //         } else {
    //             console.log('Hook already exists', githubWebHook.id)
    //         }
    //         // TODO:  update hook_id in report
    //     } catch (e) {
    //         console.log(e)
    //         // TODO: eliminar report
    //     }
    // }

    // private async onGithubHook(event: any): Promise<void> {
    //     // TODO: remove these lines
    //     console.log('onGithubHook', event)
    //     const accessToken = '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'

    //     const start = new Date().getTime()
    //     Logger.log(`Starting Github import`, HooksService.name)
    //     try {
    //         Logger.log(`Validating webhook event`, HooksService.name)
    //         const { commit, message } = await this.validateGithubEvent(accessToken, event)
    //         if (commit == null) {
    //             Logger.error(message, null, HooksService.name)
    //             return
    //         }
    //         Logger.log(`Webhook event validated`, HooksService.name)

    //         Logger.log(`Downloading and extracting repository`, HooksService.name)
    //         const extractedDir = `/tmp/${uuidv4()}`
    //         const zipTarget = `/tmp/${commit}.zip`
    //         const downloadedFiles: boolean = await this.downloadGithubFiles(commit, zipTarget, extractedDir, event.repository, accessToken)
    //         if (!downloadedFiles) {
    //             Logger.error(`Error downloading files`, null, HooksService.name)
    //             return
    //         }
    //         Logger.log(`Downloaded files`, HooksService.name)
    //         const size = await nodeGetFolderSize(extractedDir)
    //         Logger.log(`Downloaded folder size: ${size}`, HooksService.name)

    //         const files = await glob(`${extractedDir}/**`, { nodir: true, dot: true })
    //         const [extractedDirFinal] = await glob(`${extractedDir}/*`, { dot: true })
    //         const files2 = files.reduce((acc, file) => {
    //             acc.push({ path: file.replace(`${extractedDirFinal}/`, '') })
    //             return acc
    //         }, [])

    //         const knowledgeRepoConfig: any = files2.find((file) => file.path === '.knowledge_repo_config.yml')
    //         if (knowledgeRepoConfig) {
    //             Logger.log(`Import is a knowledge repository`, HooksService.name)
    //         }

    //         const kysofile: any = await this.getConfigFile(extractedDirFinal)

    //         let eventBranch = 'main'
    //         if (event.ref) {
    //             eventBranch = event.ref.split('/').slice(-1)[0]
    //         }

    //         if (eventBranch !== 'main' && !kysofile) {
    //             Logger.error(`If you want to push a non-main branch you must specify it in the kyso.yaml file`, null, HooksService.name)
    //             return
    //         }

    //         if (eventBranch !== 'main' && !kysofile.branch) {
    //             Logger.error(`If you want to push a non-main branch you must specify it in the kyso.yaml file`, null, HooksService.name)
    //             return
    //         }

    //         if (kysofile && kysofile.branch && eventBranch !== kysofile.branch) {
    //             Logger.error(`kyso.yaml specifies ${kysofile.branch} branch but commit was to ${eventBranch}`, null, HooksService.name)
    //             return
    //         }

    //         Logger.log(`Hashing files`, HooksService.name)
    //         const { fileMap, versionHash } = await this.prepareFiles(files, extractedDir)
    //         Logger.log(`Prepped and hashed files files. Creating version`, HooksService.name)

    //         // TODO: versiones

    //         // const postFolders = await this.getSubPosts(kysofile, knowledgeRepoConfig, extractedDir)
    //         // if (postFolders && postFolders.length > 0) {
    //         //     Logger.log(`Repository has child posts. Importing them now`)
    //         //     if (kysofile.hideRoot) {
    //         //     }
    //         // }

    //         Logger.log(`Done with Github Hook [${Math.round((new Date().getTime() - start) / 1000)}]`, HooksService.name)
    //     } catch (e) {
    //         Logger.error(`An error occurred importing github project`, e, HooksService.name)
    //     }
    // }

    // private async validateGithubEvent(accessToken: string, event: any): Promise<{ commit: string; message: string }> {
    //     if (event.repository.size > 500000) {
    //         return { commit: null, message: 'Repository too big (> 500mb)' }
    //     }
    //     let commit = null
    //     let message = null
    //     if (!event.head_commit) {
    //         const octokit = new Octokit({
    //             auth: `token ${accessToken}`,
    //         })
    //         const commits = await octokit.repos.listCommits({
    //             owner: event.repository.owner.login,
    //             repo: event.repository.name,
    //         })
    //         if (!commits.data.length) {
    //             return { commit: null, message: 'this repo has no commits' }
    //         }
    //         commit = commits.data[0].sha
    //         message = commits.data[0].commit.message
    //     } else {
    //         message = event.head_commit.message
    //         commit = event.head_commit.id
    //     }
    //     return { message, commit }
    // }

    // private async downloadGithubFiles(commit: string, zipFilePath: string, extractedDir: string, repository: any, accessToken: string): Promise<boolean> {
    //     try {
    //         const zipUrl: string = repository.archive_url.replace('{archive_format}{/ref}', `zipball/${commit}`)
    //         const response: AxiosResponse<any> = await axios.get(zipUrl, {
    //             headers: { Authorization: `token ${accessToken}` },
    //         })
    //         const readStream = response.data
    //         return new Promise<boolean>((resolve, reject) => {
    //             const writeStream = createWriteStream(zipFilePath, { autoClose: true })
    //             const unzipStream = unzipper.Extract({ path: extractedDir })
    //             readStream.pipe(writeStream)
    //             readStream.pipe(unzipStream)
    //             unzipStream.on('close', () => resolve(true))
    //             unzipStream.on('error', (er) => {
    //                 Logger.error(`An error occurred extracting ${zipFilePath} into ${extractedDir}`, er, HooksService.name)
    //                 console.error(er)
    //                 reject(er)
    //             })
    //             writeStream.on('error', (er) => {
    //                 Logger.error(`An error occurred writing ${zipFilePath}`, er, HooksService.name)
    //                 console.error(er)
    //                 reject(er)
    //             })
    //         })
    //     } catch (e) {
    //         Logger.error(`An error occurred downloading github files`, e, HooksService.name)
    //         return false
    //     }
    // }

    // public async getConfigFile(dir: string): Promise<any> {
    //     let kysofile = null

    //     Logger.log(`Looking at ${dir} for config file`, HooksService.name)

    //     let jsonString = null
    //     try {
    //         jsonString = readFileSync(join(dir, 'kyso.json'))
    //         Logger.log(`Found a kyso.json config file`, HooksService.name)
    //     } catch (err) {}

    //     try {
    //         jsonString = readFileSync(join(dir, '.kyso.json'))
    //         Logger.log(`Found a .kyso.json config file`, HooksService.name)
    //     } catch (err) {}

    //     if (jsonString) {
    //         try {
    //             kysofile = JSON.parse(jsonString)
    //         } catch (err) {}
    //     }

    //     let yamlString = null
    //     try {
    //         yamlString = readFileSync(join(dir, '.kyso.yaml'))
    //         Logger.log(`Found a .kyso.yaml config file`, HooksService.name)
    //     } catch (err) {}

    //     try {
    //         yamlString = readFileSync(join(dir, 'kyso.yaml'))
    //         Logger.log(`Found a kyso.yaml config file`, HooksService.name)
    //     } catch (err) {}

    //     if (yamlString) {
    //         try {
    //             Logger.log(yamlString, HooksService.name)
    //             kysofile = safeLoad(yamlString)
    //         } catch (err) {}
    //     }

    //     return kysofile
    // }

    // public async prepareFiles(files: any[], rootDir: string): Promise<{ fileMap: { [key: string]: string }; versionHash: string }> {
    //     try {
    //         const fileMap: { [key: string]: string } = {}
    //         await Promise.all(
    //             files.map(
    //                 (file) =>
    //                     new Promise<void>(async (resolve, reject) => {
    //                         const filePath = join(rootDir, file.path)
    //                         const fd = createReadStream(filePath)
    //                         const hash = crypto.createHash('sha1')
    //                         hash.setEncoding('hex')
    //                         fd.on('error', (err) => {
    //                             Logger.error(filePath, err, HooksService.name)
    //                             reject(err)
    //                         })
    //                         fd.on('end', () => {
    //                             hash.end()
    //                             const fileContentsSha = hash.read()
    //                             const sha2 = cryptoJS.algo.SHA1.create()
    //                             const fileMapHash: string = sha2.update(fileContentsSha).update(file.path).finalize().toString()
    //                             fileMap[fileMapHash] = file.path
    //                             resolve()
    //                         })
    //                         fd.pipe(hash)
    //                     }),
    //             ),
    //         )
    //         return {
    //             fileMap,
    //             versionHash: this.versionHash(fileMap),
    //         }
    //     } catch (err) {
    //         return { fileMap: null, versionHash: null }
    //     }
    // }

    // private versionHash(fileMap: { [key: string]: string }): string {
    //     const hashes = Object.keys(fileMap)
    //     const filenames = Object.keys(fileMap)
    //         .map((key) => fileMap[key])
    //         .sort()
    //     const header: string = filenames.join(',')
    //     const dataBufferList = hashes
    //         .sort() // <- NB since we need to versionHash to be the same every time
    //         .map((h) => Buffer.from(h))
    //     const headerBuffer = Buffer.from(header)
    //     const buf = Buffer.concat(dataBufferList.concat(headerBuffer)) as any
    //     return cryptoJS.SHA1(cryptoJS.lib.WordArray.create(buf)).toString()
    // }

    // private async getSubPosts(kysofile: any, knowledgeRepoConfig: any, extractedDir: string): Promise<any> {
    //     let postFolders: any
    //     if (knowledgeRepoConfig) {
    //         postFolders = await glob(`${extractedDir}/**/**.kp`, { dot: true })
    //     }

    //     if (kysofile && kysofile.posts) {
    //         let patterns = []

    //         if (kysofile.posts) {
    //             if (Array.isArray(kysofile.posts)) {
    //                 patterns = kysofile.posts
    //             } else {
    //                 patterns = [kysofile.posts]
    //             }
    //         }

    //         const res = await Promise.all(
    //             patterns.map(async (pattern) => {
    //                 let _pattern = pattern
    //                 if (!_pattern.endsWith('/')) {
    //                     _pattern = `${_pattern}/`
    //                 }
    //                 const dirs = (await glob(join(extractedDir, _pattern))).map((p) => p.slice(0, -1))
    //                 return dirs
    //             }),
    //         )

    //         postFolders = [].concat(...res)
    //     }

    //     return postFolders
    // }
}
