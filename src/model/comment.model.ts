import { ApiProperty } from "@nestjs/swagger";
import { BaseModel } from "./base.model";
import { Hateoas } from "./hateoas.model";

export class Comment extends BaseModel {
    @ApiProperty()
    public id: string;
    @ApiProperty()
    public text: string;
    @ApiProperty()
    public _p_user: string;
    @ApiProperty()
    public child_comments: Comment[];
    
}