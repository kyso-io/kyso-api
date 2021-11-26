import { ApiProperty } from "@nestjs/swagger";
import { BaseModel } from "./base.model";

export class User extends BaseModel {
    @ApiProperty()
    public id: string;
    
    @ApiProperty()
    public email: string;
    @ApiProperty()
    public username: string;
    @ApiProperty()
    public nickname: string;
    @ApiProperty()
    public avatar_url: string;
    @ApiProperty()
    public email_verified: boolean;
    @ApiProperty()
    public session_token: string;
    
    static fromGithubUser(userData: any, emailData: any): User {
        let newUser = new User();
        newUser.avatar_url = userData.avatar_url;
        newUser.username = userData.login;
        newUser.nickname = userData.name;
        newUser.email_verified = emailData.verified;
        newUser.email = emailData.email;

        return newUser;
    }
    
}