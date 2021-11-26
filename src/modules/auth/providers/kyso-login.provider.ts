import { Injectable } from "@nestjs/common";
import { UsersService } from "src/modules/users/users.service";
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class KysoLoginProvider {
    constructor(
        private readonly userService: UsersService,
        private readonly jwtService: JwtService) { }

    async login(password: string, username?: string): Promise<String> {
        // Get user from database
        let user = await this.userService.getUser({ filter: { "username": username } });

        const isRightPassword = await bcrypt.compare(password, user.hashed_password);

        if(isRightPassword) {
            // Get all the teams of the user

            // Get all the permissions for every team

            // generate token
            const token = this.jwtService.sign({
                username: user.username,
                nickname: user.nickname,
                plan: user.plan,
                id: user.id,
                email: user.email,
                // TODO: USE PERMISSION SYSTEM ;)
                teams: [{
                    name: "Team Name",
                    permissions: [
                    "READ_REPORTS",
                    "READ_COMMENTS"
                    ]}
                ]
                },
                {
                    expiresIn: "2h",
                    issuer: "kyso"
                }
            );

            return token;           
        } else {
            // throw unauthorized exception
        }
    }
}