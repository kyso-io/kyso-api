import { Injectable } from '@nestjs/common'
import { NotFoundError } from 'src/helpers/errorHandling'
import { QueryParser } from 'src/helpers/queryParser'
import { CommentsMongoProvider } from 'src/modules/comments/providers/mongo-comments.provider'

@Injectable()
export class CommentsService {
    constructor(private readonly provider: CommentsMongoProvider) {}

    async getReportComments(reportId) {
        const comments = await this.provider.getCommentsWithOwner({
            filter: {
                _p_study: QueryParser.createForeignKey('Study', reportId),
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

        if (comments.length === 0)
            throw new NotFoundError({
                message: "The specified comment couldn't be found",
            })
        const reportComments = await this.getReportComments(comments[0]._p_study)

        return reportComments.find((comment) => comment.id === commentId)
    }
}
