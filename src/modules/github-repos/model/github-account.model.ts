import { ApiProperty } from "@nestjs/swagger";

export class GithubAccount {
    @ApiProperty()
    public id: number;
    @ApiProperty()
    public login: string;
    @ApiProperty()
    public orgs: any;
}