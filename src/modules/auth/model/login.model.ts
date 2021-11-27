import { ApiProperty } from "@nestjs/swagger";
import { LoginProvider } from "./login-provider.enum";

export class Login {
    @ApiProperty()
    public username?: string;
    @ApiProperty()
    public password: string;
    @ApiProperty({
        enum: LoginProvider
    })
    public provider: LoginProvider;

    constructor() {
        this.username = "";
        this.password = "";
        this.provider = LoginProvider.KYSO;
    }
}