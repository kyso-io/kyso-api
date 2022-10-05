import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
    ElasticSearchIndex,
    EmailUserChangePasswordDTO,
    KysoEventEnum,
    KysoIndex,
    KysoPermissions,
    KysoSettingsEnum,
    KysoUserAccessToken,
    KysoUserAccessTokenStatus,
    KysoUsersCreateEvent,
    KysoUsersDeleteEvent,
    KysoUsersRecoveryPasswordEvent,
    KysoUsersUpdateEvent,
    KysoUsersVerificationEmailEvent,
    Login,
    LoginProviderEnum,
    Organization,
    SignUpDto,
    Team,
    TeamVisibilityEnum,
    Token,
    UpdateUserRequestDTO,
    User,
    UserAccount,
    UserChangePasswordDTO,
    UserForgotPassword,
    UserVerification,
    VerifyCaptchaRequestDto,
    VerifyEmailRequestDTO,
} from '@kyso-io/kyso-model'
import { ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, PreconditionFailedException, Provider } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import axios from 'axios'
import * as moment from 'moment'
import { ObjectId } from 'mongodb'
import { extname } from 'path'
import { NATSHelper } from 'src/helpers/natsHelper'
import { URLSearchParams } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import slugify from '../../helpers/slugify'
import { PlatformRole } from '../../security/platform-roles'
import { AuthService } from '../auth/auth.service'
import { GitlabLoginProvider } from '../auth/providers/gitlab-login.provider'
import { CommentsService } from '../comments/comments.service'
import { FullTextSearchService } from '../full-text-search/full-text-search.service'
import { GitlabAccessToken } from '../gitlab-repos/interfaces/gitlab-access-token'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { ReportsService } from '../reports/reports.service'
import { TeamsService } from '../teams/teams.service'
import { KysoUserAccessTokensMongoProvider } from './providers/mongo-kyso-user-access-token.provider'
import { UsersMongoProvider } from './providers/mongo-users.provider'
import { UserChangePasswordMongoProvider } from './providers/user-change-password-mongo.provider'
import { UserVerificationMongoProvider } from './providers/user-verification-mongo.provider'

function factory(service: UsersService) {
    return service
}

export function createProvider(): Provider<UsersService> {
    return {
        provide: `${UsersService.name}`,
        useFactory: (service) => factory(service),
        inject: [UsersService],
    }
}

@Injectable()
export class UsersService extends AutowiredService {
    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    @Autowired({ typeName: 'ReportsService' })
    private reportsService: ReportsService

    @Autowired({ typeName: 'CommentsService' })
    private commentsService: CommentsService

    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService

    @Autowired({ typeName: 'FullTextSearchService' })
    private fullTextSearchService: FullTextSearchService

    @Autowired({ typeName: 'AuthService' })
    private authService: AuthService

    constructor(
        private readonly kysoAccessTokenProvider: KysoUserAccessTokensMongoProvider,
        private readonly provider: UsersMongoProvider,
        private readonly userChangePasswordMongoProvider: UserChangePasswordMongoProvider,
        private readonly userVerificationMongoProvider: UserVerificationMongoProvider,
        @Inject('NATS_SERVICE') private client: ClientProxy,
    ) {
        super()
    }

    async getUsers(query): Promise<User[]> {
        let users: User[] = []

        users = await this.provider.read(query)

        return users
    }

    public async getUserById(id: string): Promise<User> {
        return this.getUser({ filter: { _id: this.provider.toObjectId(id) } })
    }

    async getUser(query): Promise<User> {
        query.limit = 1
        const users = await this.getUsers(query)
        if (users.length === 0) {
            return null
        }
        return users[0]
    }

    async updateUser(filterQuery: any, updateQuery: any): Promise<User> {
        return this.provider.update(filterQuery, updateQuery)
    }

    public async checkUsernameAvailability(username: string): Promise<boolean> {
        const organization: Organization = await this.organizationsService.getOrganization({
            filter: { sluglified_name: username },
        })
        if (organization) {
            return false
        }
        const team: Team = await this.teamsService.getTeam({ filter: { sluglified_name: username } })
        if (team) {
            return false
        }
        const user: User = await this.getUser({ filter: { username } })
        if (user) {
            return false
        }
        return true
    }

    async createUser(signUpDto: SignUpDto): Promise<User> {
        // exists a prev user with same email?
        const userWithEmail: User = await this.getUser({ filter: { email: signUpDto.email.toLowerCase() } })
        if (userWithEmail) {
            throw new ConflictException('Email in use')
        }
        const isUsernameAvailable: boolean = await this.checkUsernameAvailability(signUpDto.username)
        if (!isUsernameAvailable) {
            throw new ConflictException('Username in use')
        }
        if (signUpDto.username.includes('@')) {
            const usernameParts: string[] = signUpDto.username.split('@')
            signUpDto.username = slugify(usernameParts[0])
        }
        // Create user into database
        const newUser: User = new User(
            signUpDto.email,
            signUpDto.username,
            signUpDto.display_name,
            signUpDto.display_name,
            LoginProviderEnum.KYSO,
            null,
            null,
            null,
            'free',
            null,
            null,
            true,
            [],
            AuthService.hashPassword(signUpDto.password),
            null,
        )
        let counter = 1
        do {
            const existsUser: User = await this.getUser({ filter: { username: newUser.username } })
            if (!existsUser) {
                break
            }
            newUser.username = slugify(`${signUpDto.username}-${counter}`)
            counter++
        } while (true)
        Logger.log(`Creating new user ${signUpDto.display_name} with email ${signUpDto.email} and username ${signUpDto.username}...`, UsersService.name)
        const user: User = await this.provider.create(newUser)
        const tokenStr: string = await this.authService.login(new Login(signUpDto.password, LoginProviderEnum.KYSO, signUpDto.email, null))
        const token: Token = this.authService.evaluateAndDecodeToken(tokenStr)
        // Create user organization
        const organizationName: string = user.display_name.charAt(0).toUpperCase() + user.display_name.slice(1)
        const newOrganization: Organization = new Organization(
            organizationName,
            organizationName,
            [],
            [],
            user.email,
            '',
            '',
            true,
            '',
            '',
            '',
            '',
            uuidv4(),
            user.id,
        )
        Logger.log(`Creating new organization ${newOrganization.sluglified_name}`)

        const organizationDb: Organization = await this.organizationsService.createOrganization(token, newOrganization)

        // Create user team
        const teamName = 'Private'
        const newUserTeam: Team = new Team(teamName, '', '', '', '', [], organizationDb.id, TeamVisibilityEnum.PRIVATE, user.id)
        Logger.log(`Creating new team ${newUserTeam.sluglified_name}...`)
        const userTeamDb: Team = await this.teamsService.createTeam(token, newUserTeam)

        // Add user to team as admin
        Logger.log(`Adding ${user.display_name} to team ${userTeamDb.sluglified_name} with role ${PlatformRole.TEAM_ADMIN_ROLE.name}...`)
        await this.teamsService.addMembersById(userTeamDb.id, [user.id], [PlatformRole.TEAM_ADMIN_ROLE.name])

        Logger.log(`Sending email to ${user.email}`)

        NATSHelper.safelyEmit<KysoUsersCreateEvent>(this.client, KysoEventEnum.USERS_CREATE, {
            user,
        })

        await this.sendVerificationEmail(user)

        this.indexUser(user)

        return user
    }

    public async sendVerificationEmail(user: User): Promise<boolean> {
        if (user.email_verified) {
            Logger.log(`User ${user.display_name} already verified. Email is not sent...`, UsersService.name)
            return false
        }

        // Link to verify user email
        const hours: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.DURATION_HOURS_TOKEN_EMAIL_VERIFICATION)
        let userVerification: UserVerification = new UserVerification(user.email, uuidv4(), user.id, moment().add(hours, 'hours').toDate())
        userVerification = await this.userVerificationMongoProvider.create(userVerification)

        NATSHelper.safelyEmit<KysoUsersVerificationEmailEvent>(this.client, KysoEventEnum.USERS_VERIFICATION_EMAIL, {
            user,
            userVerification,
            frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
        })

        return true
    }

    async deleteUser(token: Token, id: string): Promise<boolean> {
        const user: User = await this.getUserById(id)
        if (!user) {
            throw new NotFoundException('User not found')
        }

        const teams: Team[] = await this.teamsService.getUserTeams(user.id)
        for (const team of teams) {
            await this.teamsService.removeMemberFromTeam(team.id, user.id)
        }

        const organizations: Organization[] = await this.organizationsService.getUserOrganizations(user.id)
        for (const organization of organizations) {
            await this.organizationsService.removeMemberFromOrganization(organization.id, user.id)
        }

        // Delete starred reports
        await this.reportsService.deleteStarredReportsByUser(user.id)

        // Delete pinned reports
        await this.reportsService.deletePinnedReportsByUser(user.id)

        // Delete comments
        await this.commentsService.deleteUserComments(user.id)

        await this.provider.deleteOne({ _id: this.provider.toObjectId(id) })

        Logger.log(`Deleting user '${user.id} ${user.display_name}' in ElasticSearch...`, UsersService.name)
        this.fullTextSearchService.deleteDocument(ElasticSearchIndex.User, user.id)

        NATSHelper.safelyEmit<KysoUsersDeleteEvent>(this.client, KysoEventEnum.USERS_DELETE, {
            user,
            owner: await this.getUserById(token.id),
        })

        return true
    }

    public async addAccount(id: string, userAccount: UserAccount): Promise<boolean> {
        const user: User = await this.getUserById(id)

        if (!user) {
            throw new PreconditionFailedException(null, `Can't add account to user as does not exists`)
        }
        if (!user.hasOwnProperty('accounts')) {
            user.accounts = []
        }
        const index: number = user.accounts.findIndex(
            (account: UserAccount) => account.accountId === userAccount.accountId && account.type === userAccount.type,
        )
        if (index !== -1) {
            throw new PreconditionFailedException(null, `The user has already registered this account`)
        } else {
            const userAccounts: UserAccount[] = [...user.accounts, userAccount]
            await this.updateUser({ _id: this.provider.toObjectId(id) }, { $set: { accounts: userAccounts } })
        }
        return true
    }

    public async removeAccount(id: string, provider: string, accountId: string): Promise<boolean> {
        const user: User = await this.getUserById(id)
        if (!user) {
            throw new NotFoundException('User not found')
        }
        if (!user.hasOwnProperty('accounts')) {
            user.accounts = []
        }

        // Bitbucket and Gitlab accountIds are strings, but Github is a number. So the account.accountId === accountId works for
        // bitbucket and gitlab, but not for github. For that reason we added .toString() to the comparison
        // to force to compare as string and avoid the github malfunction.
        const index: number = user.accounts.findIndex(
            (account: UserAccount) => account.accountId.toString() === accountId.toString() && account.type === provider,
        )
        if (index !== -1) {
            const userAccounts: UserAccount[] = [...user.accounts.slice(0, index), ...user.accounts.slice(index + 1)]
            await this.updateUser({ _id: this.provider.toObjectId(id) }, { $set: { accounts: userAccounts } })
        } else {
            throw new NotFoundException(`The user has not registered this account`)
        }
        return true
    }

    public async updateUserData(token: Token, id: string, data: UpdateUserRequestDTO): Promise<User> {
        let user: User = await this.getUserById(id)
        if (!user) {
            throw new NotFoundException('User not found')
        }
        user = await this.updateUser(
            { _id: this.provider.toObjectId(id) },
            {
                $set: {
                    location: data.location,
                    link: data.link,
                    bio: data.bio,
                },
            },
        )
        Logger.log(`Updating user '${user.id} ${user.display_name}' in Elasticsearch...`, UsersService.name)
        const kysoIndex: KysoIndex = this.userToKysoIndex(user)
        this.fullTextSearchService.updateDocument(kysoIndex)

        NATSHelper.safelyEmit<KysoUsersUpdateEvent>(this.client, KysoEventEnum.USERS_UPDATE, {
            user,
            owner: await this.getUserById(token.id),
        })

        return user
    }

    private async getS3Client(): Promise<S3Client> {
        const awsRegion = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_REGION)
        const awsAccessKey = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_ACCESS_KEY_ID)
        const awsSecretAccessKey = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_SECRET_ACCESS_KEY)

        return new S3Client({
            region: awsRegion,
            credentials: {
                accessKeyId: awsAccessKey,
                secretAccessKey: awsSecretAccessKey,
            },
        })
    }

    public async setProfilePicture(token: Token, file: any): Promise<User> {
        const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)
        const user: User = await this.getUserById(token.id)
        if (!user) {
            throw new PreconditionFailedException('User not found')
        }
        const s3Client: S3Client = await this.getS3Client()
        if (user?.avatar_url && user.avatar_url.length > 0) {
            Logger.log(`Removing previous image of user ${user.name}`, OrganizationsService.name)
            const deleteObjectCommand: DeleteObjectCommand = new DeleteObjectCommand({
                Bucket: s3Bucket,
                Key: user.avatar_url.split('/').slice(-1)[0],
            })
            await s3Client.send(deleteObjectCommand)
        }
        Logger.log(`Uploading image for user ${user.name}`, OrganizationsService.name)
        const Key = `${uuidv4()}${extname(file.originalname)}`
        await s3Client.send(
            new PutObjectCommand({
                Bucket: s3Bucket,
                Key,
                Body: file.buffer,
            }),
        )
        Logger.log(`Uploaded image for user ${user.name}`, OrganizationsService.name)
        const avatar_url = `https://${s3Bucket}.s3.amazonaws.com/${Key}`
        await this.provider.update({ _id: this.provider.toObjectId(user.id) }, { $set: { avatar_url } })
        return this.getUserById(token.id)
    }

    public async setBackgroundImage(token: Token, file: any): Promise<User> {
        const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)
        let user: User = await this.getUserById(token.id)
        if (!user) {
            throw new PreconditionFailedException('User not found')
        }
        const s3Client: S3Client = await this.getS3Client()
        if (user?.background_image_url && user.background_image_url.length > 0) {
            Logger.log(`Removing previous image of user ${user.name}`, OrganizationsService.name)
            const deleteObjectCommand: DeleteObjectCommand = new DeleteObjectCommand({
                Bucket: s3Bucket,
                Key: user.background_image_url.split('/').slice(-1)[0],
            })
            await s3Client.send(deleteObjectCommand)
        }
        Logger.log(`Uploading image for user ${user.name}`, OrganizationsService.name)
        const Key = `${uuidv4()}${extname(file.originalname)}`
        await s3Client.send(
            new PutObjectCommand({
                Bucket: s3Bucket,
                Key,
                Body: file.buffer,
            }),
        )
        Logger.log(`Uploaded background image for user ${user.name}`, OrganizationsService.name)
        const background_image_url = `https://${s3Bucket}.s3.amazonaws.com/${Key}`
        await this.provider.update({ _id: this.provider.toObjectId(user.id) }, { $set: { background_image_url } })
        return this.getUserById(token.id)
    }

    public async deleteProfilePicture(token: Token): Promise<User> {
        const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)

        const user: User = await this.getUserById(token.id)
        if (!user) {
            throw new PreconditionFailedException('User not found')
        }
        const s3Client: S3Client = await this.getS3Client()
        if (user?.avatar_url && user.avatar_url.length > 0) {
            Logger.log(`Removing previous image of user ${user.name}`, OrganizationsService.name)
            const deleteObjectCommand: DeleteObjectCommand = new DeleteObjectCommand({
                Bucket: s3Bucket,
                Key: user.avatar_url.split('/').slice(-1)[0],
            })
            await s3Client.send(deleteObjectCommand)
        }
        return this.provider.update({ _id: this.provider.toObjectId(user.id) }, { $set: { avatar_url: null } })
    }

    public async getAccessTokens(userId: string): Promise<KysoUserAccessToken[]> {
        return this.kysoAccessTokenProvider.read({
            filter: { user_id: userId },
            projection: {
                _id: 1,
                name: 1,
                user_id: 1,
                status: 1,
                expiration_date: 1,
                last_used: 1,
            },
        })
    }

    public async createKysoAccessToken(
        user_id: string,
        name: string,
        scope: KysoPermissions[],
        expiration_date?: Date,
        access_token?: string,
    ): Promise<KysoUserAccessToken> {
        const accessToken = new KysoUserAccessToken(user_id, name, KysoUserAccessTokenStatus.ACTIVE, expiration_date, null, scope, 0, access_token ?? uuidv4())
        const newKysoUserAccessToken: KysoUserAccessToken = await this.kysoAccessTokenProvider.create(accessToken)
        return newKysoUserAccessToken
    }

    public async revokeAllUserAccessToken(userId: string): Promise<KysoUserAccessToken[]> {
        await this.kysoAccessTokenProvider.updateMany({ user_id: userId }, { $set: { status: KysoUserAccessTokenStatus.REVOKED } })
        return this.getAccessTokens(userId)
    }

    public async deleteKysoAccessToken(userId: string, id: string): Promise<KysoUserAccessToken> {
        const accessTokens: KysoUserAccessToken[] = await this.kysoAccessTokenProvider.read({
            filter: { _id: this.provider.toObjectId(id) },
        })
        if (accessTokens.length === 0) {
            throw new NotFoundException('Access token not found')
        }
        const kysoAccessToken: KysoUserAccessToken = accessTokens[0]
        if (kysoAccessToken.user_id !== userId) {
            throw new ForbiddenException('Invalid credentials')
        }
        delete kysoAccessToken.access_token
        await this.kysoAccessTokenProvider.deleteOne({ _id: this.provider.toObjectId(id) })
        return kysoAccessToken
    }

    public async searchAccessToken(user_id: string, access_token: string): Promise<KysoUserAccessToken> {
        const result: KysoUserAccessToken[] = await this.kysoAccessTokenProvider.read({
            filter: {
                $and: [{ user_id: user_id }, { access_token: access_token }],
            },
        })

        if (result && result.length === 1) {
            return result[0]
        } else {
            return null
        }
    }

    public async updateGitlabUserAccount(userId: string, userAccount: UserAccount, gitlabAccessToken: GitlabAccessToken): Promise<UserAccount> {
        const user: User = await this.getUserById(userId)
        const index: number = user.accounts.findIndex((uc: UserAccount) => uc.type === LoginProviderEnum.GITLAB && uc.accountId === userAccount.accountId)
        if (index > -1) {
            user.accounts[index].accessToken = gitlabAccessToken.access_token
            user.accounts[index].payload = gitlabAccessToken
            Logger.log(`User ${user.username} is updating Gitlab account`, GitlabLoginProvider.name)
        } else {
            user.accounts.push(userAccount)
            Logger.log(`User ${user.username} is adding Gitlab account`, GitlabLoginProvider.name)
        }
        await this.updateUser({ _id: new ObjectId(user.id) }, { $set: { accounts: user.accounts } })
        return userAccount
    }

    public async verifyEmail(data: VerifyEmailRequestDTO): Promise<boolean> {
        const result: UserVerification[] = await this.userVerificationMongoProvider.read({
            filter: {
                $and: [{ email: data.email.toLowerCase() }, { token: data.token }],
            },
        })
        if (result.length === 0) {
            throw new PreconditionFailedException('Token not found')
        }
        const userVerification: UserVerification = result[0]
        if (userVerification.verified_at !== null) {
            throw new PreconditionFailedException('Verification token already used')
        }
        const user: User = await this.getUserById(userVerification.user_id)
        if (user.email_verified) {
            throw new PreconditionFailedException('Email already verified')
        }
        if (moment().isAfter(userVerification.expires_at)) {
            throw new PreconditionFailedException('Verification token expired')
        }
        await this.provider.update({ _id: new ObjectId(user.id) }, { $set: { email_verified: true } })
        await this.userVerificationMongoProvider.updateOne({ _id: new ObjectId(userVerification.id) }, { $set: { verified_at: new Date() } })
        return true
    }

    public async verifyCaptcha(userId: string, data: VerifyCaptchaRequestDto): Promise<boolean> {
        const hCaptchaEnabled: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.HCAPTCHA_ENABLED)
        if (hCaptchaEnabled.toLowerCase() === 'false') {
            await this.provider.update({ _id: new ObjectId(userId) }, { $set: { show_captcha: false } })
            return true
        } else {
            const secret: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.HCAPTCHA_SECRET_KEY)
            const sitekey: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.HCAPTCHA_SITE_KEY)
            const params = new URLSearchParams({ secret: secret, response: data.token, sitekey: sitekey })
            const response: any = await axios.post('https://hcaptcha.com/siteverify', params)
            if (response.data.success) {
                await this.provider.update({ _id: new ObjectId(userId) }, { $set: { show_captcha: false } })
                return true
            }
            return false
        }
    }

    public async changePassword(userChangePasswordDto: UserChangePasswordDTO): Promise<boolean> {
        const result: UserForgotPassword[] = await this.userChangePasswordMongoProvider.read({
            filter: {
                $and: [{ email: userChangePasswordDto.email.toLowerCase() }, { token: userChangePasswordDto.token }],
            },
        })
        if (result.length === 0) {
            throw new PreconditionFailedException('Token not found')
        }
        const userForgotPassword: UserForgotPassword = result[0]
        if (userForgotPassword.modified_at !== null) {
            throw new PreconditionFailedException('Recovery password token already used')
        }
        if (moment().isAfter(userForgotPassword.expires_at)) {
            throw new PreconditionFailedException('Recovery password token expired')
        }
        const user: User = await this.getUserById(userForgotPassword.user_id)
        const areEquals: boolean = await AuthService.isPasswordCorrect(userChangePasswordDto.password, user.hashed_password)
        if (areEquals) {
            throw new PreconditionFailedException('New password must be different from the old one')
        }
        await this.provider.updateOne(
            { _id: new ObjectId(user.id) },
            { $set: { hashed_password: AuthService.hashPassword(userChangePasswordDto.password), show_captcha: false } },
        )
        await this.userChangePasswordMongoProvider.updateOne({ _id: new ObjectId(userForgotPassword.id) }, { $set: { modified_at: new Date() } })
        return true
    }

    public async sendEmailRecoveryPassword(emailUserChangePasswordDTO: EmailUserChangePasswordDTO): Promise<boolean> {
        const user: User = await this.getUser({
            filter: {
                email: emailUserChangePasswordDTO.email,
            },
        })

        if (!user) {
            throw new PreconditionFailedException('User not registered')
        }

        const hCaptchaEnabled = (await this.kysoSettingsService.getValue(KysoSettingsEnum.HCAPTCHA_ENABLED)) === 'true' ? true : false

        if (hCaptchaEnabled) {
            const validCaptcha: boolean = await this.verifyCaptcha(user.id, { token: emailUserChangePasswordDTO.captchaToken })

            if (!validCaptcha) {
                throw new PreconditionFailedException('Invalid captcha')
            }
        }

        // Link to change user password
        const minutes: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.DURATION_MINUTES_TOKEN_RECOVERY_PASSWORD)
        let userForgotPassword: UserForgotPassword = new UserForgotPassword(encodeURI(user.email), uuidv4(), user.id, moment().add(minutes, 'minutes').toDate())
        userForgotPassword = await this.userChangePasswordMongoProvider.create(userForgotPassword)

        NATSHelper.safelyEmit<KysoUsersRecoveryPasswordEvent>(this.client, KysoEventEnum.USERS_RECOVERY_PASSWORD, {
            user,
            userForgotPassword,
            frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
        })

        return true
    }

    private userToKysoIndex(user: User): KysoIndex {
        const kysoIndex: KysoIndex = new KysoIndex()
        kysoIndex.title = user.display_name
        kysoIndex.type = ElasticSearchIndex.User
        kysoIndex.entityId = user.id
        const content: string[] = [user.email, user.display_name]
        if (user.bio) {
            content.push(user.bio)
        }
        if (user.location) {
            content.push(user.location)
        }
        if (user.link) {
            content.push(user.link)
        }
        kysoIndex.content = content.join(' ')
        kysoIndex.isPublic = true
        return kysoIndex
    }

    public async reindexUsers(): Promise<void> {
        const users: User[] = await this.getUsers({})
        await this.fullTextSearchService.deleteAllDocumentsOfType(ElasticSearchIndex.User)
        for (const user of users) {
            await this.indexUser(user)
        }
    }

    private async indexUser(user: User): Promise<any> {
        Logger.log(`Indexing user '${user.id} ${user.email}'...`, UsersService.name)
        const kysoIndex: KysoIndex = this.userToKysoIndex(user)
        return this.fullTextSearchService.indexDocument(kysoIndex)
    }
}
