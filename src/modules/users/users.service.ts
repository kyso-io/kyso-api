import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
    CreateUserRequestDTO,
    KysoPermissions,
    KysoUserAccessToken,
    KysoUserAccessTokenStatus,
    Organization,
    Team,
    TeamVisibilityEnum,
    Token,
    UpdateUserRequestDTO,
    User,
    UserAccount,
} from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Injectable, Logger, PreconditionFailedException, Provider } from '@nestjs/common'
import { extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { PlatformRole } from '../../security/platform-roles'
import { AuthService } from '../auth/auth.service'
import { CommentsService } from '../comments/comments.service'
import { KysoSettingsEnum } from '../kyso-settings/enums/kyso-settings.enum'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { ReportsService } from '../reports/reports.service'
import { TeamsService } from '../teams/teams.service'
import { KysoUserAccessTokensMongoProvider } from './providers/mongo-kyso-user-access-token.provider'
import { UsersMongoProvider } from './providers/mongo-users.provider'

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

    constructor(
        private readonly mailerService: MailerService,
        private readonly provider: UsersMongoProvider,
        private readonly kysoAccessTokenProvider: KysoUserAccessTokensMongoProvider,
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

    async createUser(userToCreate: CreateUserRequestDTO): Promise<User> {
        // exists a prev user with same email?
        const user: User = await this.getUser({ filter: { username: userToCreate.username } })

        if (!userToCreate.password) {
            throw new PreconditionFailedException(null, 'Password unset')
        }

        if (user) {
            throw new PreconditionFailedException(null, 'User already exists')
        }

        // Create user into database
        // Hash the password and delete the plain password property
        const newUser: User = User.fromCreateUserRequest(userToCreate)
        newUser.hashed_password = AuthService.hashPassword(userToCreate.password)
        Logger.log(`Creating new user ${userToCreate.display_name}...`)
        const userDb: User = await this.provider.create(newUser)

        // Create user organization
        const organizationName: string = userDb.display_name.charAt(0).toUpperCase() + userDb.display_name.slice(1) + "'s Workspace"
        const newOrganization: Organization = new Organization(organizationName, organizationName, [], [], userDb.email, '', '', true, '', '', '', '')
        Logger.log(`Creating new organization ${newOrganization.sluglified_name}`)
        const organizationDb: Organization = await this.organizationsService.createOrganization(newOrganization)

        // Add user to organization as admin
        Logger.log(`Adding ${userDb.display_name} to organization ${organizationDb.sluglified_name} with role ${PlatformRole.ORGANIZATION_ADMIN_ROLE.name}...`)
        await this.organizationsService.addMembersById(organizationDb.id, [userDb.id], [PlatformRole.ORGANIZATION_ADMIN_ROLE.name])

        // Create user team
        const teamName: string = userDb.display_name.charAt(0).toUpperCase() + userDb.display_name.slice(1) + "'s Private"
        const newUserTeam: Team = new Team(teamName, '', '', '', '', [], organizationDb.id, TeamVisibilityEnum.PRIVATE)
        Logger.log(`Creating new team ${newUserTeam.sluglified_name}...`)
        const userTeamDb: Team = await this.teamsService.createTeam(newUserTeam)

        // Add user to team as admin
        Logger.log(`Adding ${userDb.display_name} to team ${userTeamDb.sluglified_name} with role ${PlatformRole.TEAM_ADMIN_ROLE.name}...`)
        await this.teamsService.addMembersById(userTeamDb.id, [userDb.id], [PlatformRole.TEAM_ADMIN_ROLE.name])

        this.mailerService
            .sendMail({
                to: userDb.email,
                subject: 'Welcome to Kyso',
                html: `Welcome to Kyso, ${userDb.display_name}!`,
            })
            .then(() => {
                Logger.log(`Welcome mail sent to ${userDb.display_name}`, UsersService.name)
            })
            .catch((err) => {
                Logger.error(`Error sending welcome mail to ${userDb.display_name}`, err, UsersService.name)
            })

        return userDb
    }

    async deleteUser(id: string): Promise<boolean> {
        const user: User = await this.getUserById(id)
        if (!user) {
            throw new PreconditionFailedException(null, `Can't delete user as does not exists`)
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
            throw new PreconditionFailedException(null, `Can't remove account to user as does not exists`)
        }
        if (!user.hasOwnProperty('accounts')) {
            user.accounts = []
        }
        const index: number = user.accounts.findIndex((account: UserAccount) => account.accountId === accountId && account.type === provider)
        if (index !== -1) {
            const userAccounts: UserAccount[] = [...user.accounts.slice(0, index), ...user.accounts.slice(index + 1)]
            await this.updateUser({ _id: this.provider.toObjectId(id) }, { $set: { accounts: userAccounts } })
        } else {
            throw new PreconditionFailedException(null, `The user has not registered this account`)
        }
        return true
    }

    public async updateUserData(id: string, data: UpdateUserRequestDTO): Promise<User> {
        const user: User = await this.getUserById(id)
        if (!user) {
            throw new PreconditionFailedException(null, `Can't update user as does not exists`)
        }
        return this.updateUser(
            { _id: this.provider.toObjectId(id) },
            {
                $set: {
                    location: data.location,
                    link: data.link,
                    bio: data.bio,
                },
            },
        )
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

    // Commented type throwing an Namespace 'global.Express' has no exported member 'Multer' error
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
        return this.provider.update({ _id: this.provider.toObjectId(user.id) }, { $set: { avatar_url } })
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
        })
    }

    public async createKysoAccessToken(user_id: string, name: string, scope: KysoPermissions[], expiration_date?: Date): Promise<KysoUserAccessToken> {
        const accessToken = new KysoUserAccessToken(user_id, name, KysoUserAccessTokenStatus.ACTIVE, expiration_date, null, scope, 0, uuidv4())
        const newKysoUserAccessToken: KysoUserAccessToken = await this.kysoAccessTokenProvider.create(accessToken)
        return newKysoUserAccessToken
    }

    public async revokeAllUserAccessToken(userId: string): Promise<KysoUserAccessToken[]> {
        await this.kysoAccessTokenProvider.updateMany(
            { user_id: userId },
            { $set: { status: KysoUserAccessTokenStatus.REVOKED } },
        )
        return this.getAccessTokens(userId)
    }

    public async deleteKysoAccessToken(userId: string, id: string): Promise<KysoUserAccessToken> {
        const accessTokens: KysoUserAccessToken[] = await this.kysoAccessTokenProvider.read({
            filter: { _id: this.provider.toObjectId(id) },
        })
        if (accessTokens.length === 0) {
            throw new PreconditionFailedException('Access token not found')
        }
        const kysoAccessToken: KysoUserAccessToken = accessTokens[0]
        if (kysoAccessToken.user_id !== userId) {
            throw new PreconditionFailedException('Invalid credentials')
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
}
