import { Logger } from '@nestjs/common';
import { CommentsService } from 'src/modules/comments/comments.service';
import { Comment } from '@kyso-io/kyso-model';

export class CommentTDDHelper {
  public static async createComment(comment: Comment, commentsService: CommentsService): Promise<Comment> {
    try {
      Logger.log(`Creating ${comment.text} comment...`);
      return commentsService.createCommentWithoutNotifications(comment);
    } catch (ex) {
      Logger.log(`"${comment.text}" comment already exists`);
    }
  }
}
