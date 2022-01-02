import { Injectable } from '@nestjs/common'
import { NotFoundError } from 'src/helpers/errorHandling'
import { QueryParser } from 'src/helpers/queryParser'
import { User } from 'src/model/user.model'
import { Comment } from 'src/model/comment.model'
import { CommentsMongoProvider } from 'src/modules/comments/providers/mongo-comments.provider'

@Injectable()
export class CommentsService {
    constructor(private readonly provider: CommentsMongoProvider) {}

    async createComment(comment: Comment) {
        return this.provider.create(comment)
    }

    async getComments(query) {
        const comments = await this.provider.read({
            filter: query,
            sort: { _created_at: -1 },
        })

        return comments
    }

    async getCommentWithChildren(commentId) {
        const comments = await this.provider.read({
            filter: { _id: commentId },
            limit: 1,
        })

        if (comments.length === 0) {
            throw new NotFoundError({ message: "The specified comment couldn't be found" })
        }

        return comments
        // const reportComments = await this.getReportComments(comments[0].report_id)

        // return reportComments.find((comment) => comment.id === commentId)
    }
}
