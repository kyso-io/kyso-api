import { Injectable } from '@nestjs/common';
import { MongoProvider } from 'src/providers/mongo.provider';

@Injectable()
export class CommentsMongoProvider extends MongoProvider {
    provider: any;

    constructor() {
        super("Comment")
    }
}
