import { ApiProperty } from "@nestjs/swagger";
import { Hateoas } from "./hateoas.model";

export class Branch {
    @ApiProperty()
    public name: string;
    @ApiProperty()
    public commit: string;
    @ApiProperty()
    public content_url: Hateoas;
    @ApiProperty()
    public commits_url: Hateoas[];
    @ApiProperty()
    public is_default: boolean;
    
}