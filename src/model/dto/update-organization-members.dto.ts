import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsMongoId, IsNotEmpty, ValidateNested } from 'class-validator'

export class UpdateOrganizationMembers {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => UserRole)
    public members: UserRole[]
}

export class UserRole {
    @IsMongoId({ each: true })
    public user_id: string

    @IsNotEmpty()
    public role: string
}
