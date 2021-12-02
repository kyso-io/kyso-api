import { ApiProperty } from '@nestjs/swagger'
import { Permissions } from 'src/security/general-permissions.enum'
import { BaseModel } from './base.model'

export class User extends BaseModel {
    @ApiProperty()
    public id: string

    @ApiProperty()
    public email: string
    @ApiProperty()
    public username: string
    @ApiProperty()
    public nickname: string
    @ApiProperty()
    public avatarUrl: string
    @ApiProperty()
    public email_verified: boolean
    @ApiProperty()
    public session_token: string

    @ApiProperty({
        description: `List of permissions related to this user. See permission reference for more details`,
        required: false,
        isArray: true
    })
    public direct_permissions?: Permissions[]

    @ApiProperty()
    public bio?: string

    @ApiProperty()
    public profilePicture?: string

    static fromGithubUser(userData: any, emailData: any): User {
        let newUser = new User()
        newUser.avatarUrl = userData.avatar_url
        newUser.username = userData.login
        newUser.nickname = userData.name
        newUser.email_verified = emailData.verified
        newUser.email = emailData.email

        return newUser
    }
}
