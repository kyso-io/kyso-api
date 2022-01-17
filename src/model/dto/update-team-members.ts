import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator'

export class UpdateTeamMembers {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => UserRole)
    public members: UserRole[]
}

export class UserRole {
    @IsString()
    public username: string

    @IsNotEmpty()
    public role: string
}
