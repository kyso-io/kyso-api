import { ApiProperty } from "@nestjs/swagger";
import { BaseModel } from "./base.model";
import { Hateoas } from "./hateoas.model";

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
}