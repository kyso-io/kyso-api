import { BitbucketReposProvider } from './bitbucket-repo.provider'

describe('Bitbucket provider suite test', () => {
    beforeAll(() => {
        console.log('Checking that env files are loaded correctly')

        expect(process.env.BITBUCKET_API === undefined).toBe(false)
        expect(process.env.BITBUCKET_USER === undefined).toBe(false)
        expect(process.env.BITBUCKET_APP_PASSWORD === undefined).toBe(false)
    })

    test('[BASIC-AUTH + APP_PASSWORD] Get all repositories for an user', async () => {
        const bucket = new BitbucketReposProvider()

        bucket.withUserAndAppPassword(process.env.BITBUCKET_USER, process.env.BITBUCKET_APP_PASSWORD)

        const result = await bucket.getAllRepos()

        expect(result).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: 'my-first-repository' }),
                expect.objectContaining({ name: 'my-second-repository' }),
                expect.objectContaining({ name: 'test' }),
            ]),
        )
    })

    test('[BASIC-AUTH + APP_PASSWORD] Get a repository by name and workspace', async () => {
        const bucket = new BitbucketReposProvider()

        bucket.withUserAndAppPassword(process.env.BITBUCKET_USER, process.env.BITBUCKET_APP_PASSWORD)

        const result = await bucket.getRepo('test-kuso', 'my-first-repository')

        expect(result.name).toEqual('my-first-repository')
    })

    test('[BASIC-AUTH + APP_PASSWORD] Get workspaces for a user', async () => {
        const bucket = new BitbucketReposProvider()
        bucket.withUserAndAppPassword(process.env.BITBUCKET_USER, process.env.BITBUCKET_APP_PASSWORD)

        const result = await bucket.getWorkspaces(1, 50)

        expect(result.values).toEqual(
            expect.arrayContaining([expect.objectContaining({ slug: 'test-kuso' }), expect.objectContaining({ slug: 'kyso-practicioner' })]),
        )
    })

    test('[BASIC-AUTH + APP_PASSWORD] Get workspaces paginated for an user', async () => {
        const bucket = new BitbucketReposProvider()

        bucket.withUserAndAppPassword(process.env.BITBUCKET_USER, process.env.BITBUCKET_APP_PASSWORD)

        const firstResult = await bucket.getWorkspaces(1, 1)

        expect(firstResult.values.length).toBe(1)

        let accumulatedData = [...firstResult.values]

        const secondResult = await bucket.getWorkspaces(2, 1)

        expect(secondResult.values.length).toBe(1)

        accumulatedData = [...accumulatedData, ...secondResult.values]

        expect(accumulatedData).toEqual(
            expect.arrayContaining([expect.objectContaining({ slug: 'test-kuso' }), expect.objectContaining({ slug: 'kyso-practicioner' })]),
        )
    })

    test('[BASIC-AUTH + APP_PASSWORD] Search repository', async () => {
        const bucket = new BitbucketReposProvider()

        bucket.withUserAndAppPassword(process.env.BITBUCKET_USER, process.env.BITBUCKET_APP_PASSWORD)

        const searchResult = await bucket.searchRepos(`name ~ "second"`, 'test-kuso', 1, 20)

        expect(searchResult.length).toBe(1)
        expect(searchResult[0].name).toBe('my-second-repository')
    })

    test('[BASIC-AUTH + APP_PASSWORD] Get branches of a repository', async () => {
        const bucket = new BitbucketReposProvider()

        bucket.withUserAndAppPassword(process.env.BITBUCKET_USER, process.env.BITBUCKET_APP_PASSWORD)

        const branches = await bucket.getBranches('test-kuso', 'my-second-repository', 1, 10)

        expect(branches[0].name).toBe('main')
        expect(branches[0].commit).toBe('658cf60ce0ae557a43680402149708886c2f240c')
    })

    test('[BASIC-AUTH + APP_PASSWORD] Get commits of a repository and branch', async () => {
        const bucket = new BitbucketReposProvider()

        bucket.withUserAndAppPassword(process.env.BITBUCKET_USER, process.env.BITBUCKET_APP_PASSWORD)

        const commits = await bucket.getCommits('test-kuso', 'my-second-repository', 'main', 1, 10)

        expect(commits[0].message).toBe('Initial commit')
        expect(commits[0].author.email).toBe('kyso.practicioner@gmail.com')
        expect(commits[0].sha).toBe('658cf60ce0ae557a43680402149708886c2f240c')
    })

    test('[BASIC-AUTH + APP_PASSWORD] Get files and folders main branch', async () => {
        const bucket = new BitbucketReposProvider()

        bucket.withUserAndAppPassword(process.env.BITBUCKET_USER, process.env.BITBUCKET_APP_PASSWORD)

        const results = await bucket.getRootFilesAndFolders('test-kuso', 'my-second-repository', null)

        expect(results.data).toEqual(expect.arrayContaining([expect.objectContaining({ path: '.gitignore' }), expect.objectContaining({ path: 'README.md' })]))
    })

    test('[BASIC-AUTH + APP_PASSWORD] Get files and folders by branch', async () => {
        const bucket = new BitbucketReposProvider()

        bucket.withUserAndAppPassword(process.env.BITBUCKET_USER, process.env.BITBUCKET_APP_PASSWORD)
        const commitsByBranch = await bucket.getCommits('test-kuso', 'my-first-repository', 'my_test_branch', 1, 10)

        // commitsByBranch[0] is the last commit

        const results = await bucket.getRootFilesAndFoldersByCommit('test-kuso', 'my-first-repository', commitsByBranch[0].sha, null)

        expect(results.data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: '.gitignore' }),
                expect.objectContaining({ path: 'README.md' }),
                expect.objectContaining({ path: 'MalcomInTheBranch.md' }),
            ]),
        )
    })

    test('[BASIC-AUTH + APP_PASSWORD] Get files and folders by branch paginated', async () => {
        const bucket = new BitbucketReposProvider()

        bucket.withUserAndAppPassword(process.env.BITBUCKET_USER, process.env.BITBUCKET_APP_PASSWORD)
        const commitsByBranch = await bucket.getCommits('test-kuso', 'my-first-repository', 'my_test_branch', 1, 10)

        // commitsByBranch[0] is the last commit

        const results = await bucket.getRootFilesAndFoldersByCommit('test-kuso', 'my-first-repository', commitsByBranch[0].sha, null)

        expect(results.data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: '.gitignore' }),
                expect.objectContaining({ path: 'README.md' }),
                expect.objectContaining({ path: 'MalcomInTheBranch.md' }),
            ]),
        )

        // Then take the second page
        const secondPageResults = await bucket.getRootFilesAndFoldersByCommit('test-kuso', 'my-first-repository', commitsByBranch[0].sha, results.nextPageCode)

        expect(secondPageResults.data).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'TheRiseOfTheBranch.md' })]))
    })

    test('[BASIC-AUTH + APP_PASSWORD] Get file content from main branch', async () => {
        const bucket = new BitbucketReposProvider()

        bucket.withUserAndAppPassword(process.env.BITBUCKET_USER, process.env.BITBUCKET_APP_PASSWORD)

        const commitsByBranch = await bucket.getCommits('test-kuso', 'my-first-repository', 'my_test_branch', 1, 10)

        // commitsByBranch[0] is the last commit
        const fileContent = await bucket.getFileContent('test-kuso', 'my-first-repository', commitsByBranch[0].sha, 'TheRiseOfTheBranch.md')

        let buff = Buffer.from(fileContent, 'base64')
        const receivedString = buff.toString()

        expect(receivedString).toEqual('# The Rise of the Branch')
    })

    test('[BASIC-AUTH + APP_PASSWORD] Get current user', async () => {
        const bucket = new BitbucketReposProvider()

        bucket.withUserAndAppPassword(process.env.BITBUCKET_USER, process.env.BITBUCKET_APP_PASSWORD)

        const currentUser = await bucket.getUser()

        expect(currentUser.username).toEqual('kyso-practicioner')
    })
})
