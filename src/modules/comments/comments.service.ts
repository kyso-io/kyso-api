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

    async getReportComments(reportId) {
        const comments = await this.provider.getCommentsWithOwner({
            filter: {
                report_rel: QueryParser.createForeignKey('Study', reportId),
            },
            sort: { _created_at: -1 },
        })

        const commentMap = {}
        const parents = []
        const childs = []

        comments.forEach((comment) => {
            comment.comments = []
            commentMap[comment.id] = comment

            // WAITING FOR EOIN
            /*
            if (comment.parent !== null) {
                childs.push(comment)
            }
            else {
                parents.push(comment)
            }
            */
        })

        childs.forEach((child) => {
            if (commentMap[child._p_parent]) commentMap[child._p_parent].comments.push(child)
        })

        return parents
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
        // const reportComments = await this.getReportComments(comments[0].report_rel)

        // return reportComments.find((comment) => comment.id === commentId)
    }
}
