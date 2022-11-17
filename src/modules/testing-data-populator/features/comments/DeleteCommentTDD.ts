import { Logger } from '@nestjs/common';
import { CommentsService } from 'src/modules/comments/comments.service';
import { Comment, User } from '@kyso-io/kyso-model';
import { CommentTDDHelper } from './CommentTDDHelper';

export class DeleteCommentTDD {
  public static async createTestingData(
    commentsService: CommentsService,
    faker: any,
    reportPublicForCommentsFeature: string,
    reportPrivateForCommentsFeature: string,
    bb8_Contributor: User,
    c3po_Reader: User,
    Kylo_TeamContributorUser: User,
    Ahsoka_ExternalUser: User,
    Chewbacca_TeamReaderUser: User,
    Leia_OrgAdmin: User,
    Rey_TeamAdminUser: User,
    BabyYoda_OrganizationAdminUser: User,
    Amidala_Reader: User,
    Mando_OrgAdmin: User,
  ): Promise<void> {
    // api-tests comments for automatic testing
    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        bb8_Contributor.id, // author
        reportPublicForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '63763836c4b37ed7ce2c0061', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        c3po_Reader.id, // author
        reportPublicForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '6376395f291927634fb52f76', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        Kylo_TeamContributorUser.id, // author
        reportPrivateForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '63763b6a338ab11639eec6f7', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        c3po_Reader.id, // author
        reportPrivateForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '637644f0ab4c89731504672b', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        Ahsoka_ExternalUser.id, // author
        reportPublicForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '63764520e9ba2d7b7273dcdf', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        Chewbacca_TeamReaderUser.id, // author
        reportPrivateForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '6376458476bcbff63263a18c', // parent_comment_id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        Kylo_TeamContributorUser.id, // author
        reportPrivateForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '637645cddb69a6b680019d35', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        Ahsoka_ExternalUser.id, // author
        reportPrivateForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '63764603386e2998d5a22348', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        Leia_OrgAdmin.id, // author
        reportPublicForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '63764661a393c514802adaed', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        Rey_TeamAdminUser.id, // author
        reportPublicForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '6376467d6c4e419eb53b76f5', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        Rey_TeamAdminUser.id, // author
        reportPrivateForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '637646cd78e55a49eab84b51', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        BabyYoda_OrganizationAdminUser.id, // author
        reportPrivateForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '6376471b43ed65102c61aafb', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        Amidala_Reader.id, // author
        reportPrivateForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '637647470cb8805adced23e4', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        Amidala_Reader.id, // author
        reportPrivateForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '6376479348611f2c2791797d', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        Mando_OrgAdmin.id, // author
        reportPrivateForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '63764814df4e2e0bfd911588', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        BabyYoda_OrganizationAdminUser.id, // author
        reportPrivateForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '637648709cc1777e2ab60a8f', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        bb8_Contributor.id, // author
        reportPublicForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '637648ad1c5b4cdc30ead36a', // id
      ),
      commentsService,
    );

    await CommentTDDHelper.createComment(
      new Comment(
        faker.hacker.phrase(), // text
        faker.hacker.phrase(), // plain_text
        Leia_OrgAdmin.id, // author
        reportPublicForCommentsFeature, // report_id
        null, // discussion_id
        null, // parent_comment_id
        [], // mentions
        '637648d8aca006fbd01fded1', // id
      ),
      commentsService,
    );
  }
}
