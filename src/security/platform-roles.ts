import {
  BitbucketRepoPermissionsEnum,
  CommentPermissionsEnum,
  DiscussionPermissionsEnum,
  GithubRepoPermissionsEnum,
  GitlabRepoPermissionsEnum,
  GlobalPermissionsEnum,
  InlineCommentPermissionsEnum,
  KysoRole,
  OrganizationPermissionsEnum,
  ReportPermissionsEnum,
  StoragePermissionsEnum,
  TeamPermissionsEnum,
  UserPermissionsEnum,
} from '@kyso-io/kyso-model';
import * as mongo from 'mongodb';

export class PlatformRole {
  public static getFriendlyNameFromArray = (key: string[]): string[] => {
    return key.map((k: string) => PlatformRole.getFriendlyName(k));
  };

  public static getFriendlyName = (key: string): string => {
    if (!key) {
      return 'User';
    }

    switch (key.toLowerCase()) {
      case 'platform-admin':
        return 'Global administrator';
      case 'team-admin':
        return 'Channel administrator';
      case 'team-contributor':
        return 'Contributor';
      case 'team-reader':
        return 'Reader';
      case 'organization-admin':
        return 'Organization administrator';
      case 'external':
        return 'External user';
      default:
        return 'User';
    }
  };
  public static PLATFORM_ADMIN_ROLE = new KysoRole(
    'platform-admin',
    [
      GlobalPermissionsEnum.GLOBAL_ADMIN,
      StoragePermissionsEnum.READ,
      CommentPermissionsEnum.ADMIN,
      CommentPermissionsEnum.CREATE,
      CommentPermissionsEnum.DELETE,
      CommentPermissionsEnum.EDIT,
      CommentPermissionsEnum.READ,
      InlineCommentPermissionsEnum.CREATE,
      InlineCommentPermissionsEnum.DELETE,
      InlineCommentPermissionsEnum.EDIT,
      InlineCommentPermissionsEnum.READ,
      GithubRepoPermissionsEnum.ADMIN,
      GithubRepoPermissionsEnum.CREATE,
      GithubRepoPermissionsEnum.DELETE,
      GithubRepoPermissionsEnum.EDIT,
      GithubRepoPermissionsEnum.READ,
      BitbucketRepoPermissionsEnum.ADMIN,
      BitbucketRepoPermissionsEnum.CREATE,
      BitbucketRepoPermissionsEnum.DELETE,
      BitbucketRepoPermissionsEnum.EDIT,
      BitbucketRepoPermissionsEnum.READ,
      GitlabRepoPermissionsEnum.ADMIN,
      GitlabRepoPermissionsEnum.CREATE,
      GitlabRepoPermissionsEnum.DELETE,
      GitlabRepoPermissionsEnum.EDIT,
      GitlabRepoPermissionsEnum.READ,
      OrganizationPermissionsEnum.ADMIN,
      OrganizationPermissionsEnum.CREATE,
      OrganizationPermissionsEnum.DELETE,
      OrganizationPermissionsEnum.EDIT,
      OrganizationPermissionsEnum.READ,
      ReportPermissionsEnum.ADMIN,
      ReportPermissionsEnum.CREATE,
      ReportPermissionsEnum.DELETE,
      ReportPermissionsEnum.EDIT,
      ReportPermissionsEnum.READ,
      ReportPermissionsEnum.GLOBAL_PIN,
      TeamPermissionsEnum.ADMIN,
      TeamPermissionsEnum.CREATE,
      TeamPermissionsEnum.DELETE,
      TeamPermissionsEnum.EDIT,
      TeamPermissionsEnum.READ,
      UserPermissionsEnum.ADMIN,
      UserPermissionsEnum.CREATE,
      UserPermissionsEnum.DELETE,
      UserPermissionsEnum.EDIT,
      UserPermissionsEnum.READ,
      DiscussionPermissionsEnum.ADMIN,
      DiscussionPermissionsEnum.READ,
      DiscussionPermissionsEnum.EDIT,
      DiscussionPermissionsEnum.DELETE,
      DiscussionPermissionsEnum.CREATE,
    ],
    new mongo.ObjectId('61a8ae8f9c2bc3c5a2144069').toString(),
  );

  public static TEAM_ADMIN_ROLE = new KysoRole(
    'team-admin',
    [
      StoragePermissionsEnum.READ,
      CommentPermissionsEnum.ADMIN,
      CommentPermissionsEnum.CREATE,
      CommentPermissionsEnum.DELETE,
      CommentPermissionsEnum.EDIT,
      CommentPermissionsEnum.READ,
      InlineCommentPermissionsEnum.CREATE,
      InlineCommentPermissionsEnum.DELETE,
      InlineCommentPermissionsEnum.EDIT,
      InlineCommentPermissionsEnum.READ,
      GithubRepoPermissionsEnum.ADMIN,
      GithubRepoPermissionsEnum.CREATE,
      GithubRepoPermissionsEnum.DELETE,
      GithubRepoPermissionsEnum.EDIT,
      GithubRepoPermissionsEnum.READ,
      BitbucketRepoPermissionsEnum.ADMIN,
      BitbucketRepoPermissionsEnum.CREATE,
      BitbucketRepoPermissionsEnum.DELETE,
      BitbucketRepoPermissionsEnum.EDIT,
      BitbucketRepoPermissionsEnum.READ,
      OrganizationPermissionsEnum.READ,
      ReportPermissionsEnum.ADMIN,
      ReportPermissionsEnum.CREATE,
      ReportPermissionsEnum.DELETE,
      ReportPermissionsEnum.EDIT,
      ReportPermissionsEnum.READ,
      ReportPermissionsEnum.GLOBAL_PIN,
      TeamPermissionsEnum.ADMIN,
      TeamPermissionsEnum.EDIT,
      TeamPermissionsEnum.READ,
      UserPermissionsEnum.EDIT,
      UserPermissionsEnum.READ,
      DiscussionPermissionsEnum.ADMIN,
      DiscussionPermissionsEnum.CREATE,
      DiscussionPermissionsEnum.READ,
      DiscussionPermissionsEnum.EDIT,
      DiscussionPermissionsEnum.DELETE,
    ],
    new mongo.ObjectId('61a8ae8f9c2bc3c5a2144070').toString(),
  );

  public static TEAM_CONTRIBUTOR_ROLE = new KysoRole(
    'team-contributor',
    [
      CommentPermissionsEnum.CREATE,
      CommentPermissionsEnum.EDIT,
      CommentPermissionsEnum.READ,
      CommentPermissionsEnum.DELETE_ONLY_MINE,
      InlineCommentPermissionsEnum.CREATE,
      InlineCommentPermissionsEnum.DELETE,
      InlineCommentPermissionsEnum.EDIT,
      InlineCommentPermissionsEnum.READ,
      GithubRepoPermissionsEnum.CREATE,
      GithubRepoPermissionsEnum.EDIT,
      GithubRepoPermissionsEnum.READ,
      BitbucketRepoPermissionsEnum.CREATE,
      BitbucketRepoPermissionsEnum.EDIT,
      BitbucketRepoPermissionsEnum.READ,
      GitlabRepoPermissionsEnum.CREATE,
      GitlabRepoPermissionsEnum.EDIT,
      GitlabRepoPermissionsEnum.READ,
      OrganizationPermissionsEnum.READ,
      ReportPermissionsEnum.CREATE,
      ReportPermissionsEnum.DELETE,
      ReportPermissionsEnum.EDIT_ONLY_MINE,
      ReportPermissionsEnum.READ,
      TeamPermissionsEnum.READ,
      UserPermissionsEnum.EDIT,
      UserPermissionsEnum.READ,
      DiscussionPermissionsEnum.READ,
      DiscussionPermissionsEnum.CREATE,
      DiscussionPermissionsEnum.EDIT_ONLY_MINE,
    ],
    new mongo.ObjectId('61a8ae8f9c2bc3c5a2144071').toString(),
  );

  public static TEAM_READER_ROLE = new KysoRole(
    'team-reader',
    [
      CommentPermissionsEnum.CREATE,
      CommentPermissionsEnum.EDIT,
      CommentPermissionsEnum.READ,
      CommentPermissionsEnum.DELETE_ONLY_MINE,
      InlineCommentPermissionsEnum.CREATE,
      InlineCommentPermissionsEnum.DELETE,
      InlineCommentPermissionsEnum.EDIT,
      InlineCommentPermissionsEnum.READ,
      GithubRepoPermissionsEnum.READ,
      BitbucketRepoPermissionsEnum.READ,
      OrganizationPermissionsEnum.READ,
      ReportPermissionsEnum.READ,
      TeamPermissionsEnum.READ,
      UserPermissionsEnum.EDIT, // Always can edit his own profile
      UserPermissionsEnum.READ,
      DiscussionPermissionsEnum.READ,
    ],
    new mongo.ObjectId('61a8ae8f9c2bc3c5a2144072').toString(),
  );

  public static ORGANIZATION_ADMIN_ROLE = new KysoRole(
    'organization-admin',
    [
      StoragePermissionsEnum.READ,
      CommentPermissionsEnum.ADMIN,
      CommentPermissionsEnum.CREATE,
      CommentPermissionsEnum.DELETE,
      CommentPermissionsEnum.EDIT,
      CommentPermissionsEnum.READ,
      InlineCommentPermissionsEnum.CREATE,
      InlineCommentPermissionsEnum.DELETE,
      InlineCommentPermissionsEnum.EDIT,
      InlineCommentPermissionsEnum.READ,
      GithubRepoPermissionsEnum.ADMIN,
      GithubRepoPermissionsEnum.CREATE,
      GithubRepoPermissionsEnum.DELETE,
      GithubRepoPermissionsEnum.EDIT,
      GithubRepoPermissionsEnum.READ,
      BitbucketRepoPermissionsEnum.ADMIN,
      BitbucketRepoPermissionsEnum.CREATE,
      BitbucketRepoPermissionsEnum.DELETE,
      BitbucketRepoPermissionsEnum.EDIT,
      BitbucketRepoPermissionsEnum.READ,
      GitlabRepoPermissionsEnum.ADMIN,
      GitlabRepoPermissionsEnum.CREATE,
      GitlabRepoPermissionsEnum.DELETE,
      GitlabRepoPermissionsEnum.EDIT,
      GitlabRepoPermissionsEnum.READ,
      OrganizationPermissionsEnum.ADMIN,
      OrganizationPermissionsEnum.CREATE,
      OrganizationPermissionsEnum.DELETE,
      OrganizationPermissionsEnum.EDIT,
      OrganizationPermissionsEnum.READ,
      ReportPermissionsEnum.ADMIN,
      ReportPermissionsEnum.CREATE,
      ReportPermissionsEnum.DELETE,
      ReportPermissionsEnum.EDIT,
      ReportPermissionsEnum.READ,
      ReportPermissionsEnum.GLOBAL_PIN,
      TeamPermissionsEnum.ADMIN,
      TeamPermissionsEnum.CREATE,
      TeamPermissionsEnum.DELETE,
      TeamPermissionsEnum.EDIT,
      TeamPermissionsEnum.READ,
      UserPermissionsEnum.CREATE,
      UserPermissionsEnum.DELETE,
      UserPermissionsEnum.EDIT,
      UserPermissionsEnum.READ,
      DiscussionPermissionsEnum.ADMIN,
      DiscussionPermissionsEnum.READ,
      DiscussionPermissionsEnum.EDIT,
      DiscussionPermissionsEnum.DELETE,
      DiscussionPermissionsEnum.CREATE,
    ],
    new mongo.ObjectId('61a8ae8f9c2bc3c5a2144073').toString(),
  );

  public static EXTERNAL_ROLE = new KysoRole(
    'external',
    [
      CommentPermissionsEnum.READ,
      InlineCommentPermissionsEnum.READ,
      GithubRepoPermissionsEnum.READ,
      BitbucketRepoPermissionsEnum.READ,
      OrganizationPermissionsEnum.READ,
      ReportPermissionsEnum.READ,
      TeamPermissionsEnum.READ,
      UserPermissionsEnum.READ,
      DiscussionPermissionsEnum.READ,
    ],
    new mongo.ObjectId('62e963cf8b50cbfe2301c7da').toString(),
  );

  public static ALL_PLATFORM_ROLES: KysoRole[] = [this.PLATFORM_ADMIN_ROLE, this.ORGANIZATION_ADMIN_ROLE, this.TEAM_ADMIN_ROLE, this.TEAM_CONTRIBUTOR_ROLE, this.TEAM_READER_ROLE, this.EXTERNAL_ROLE];
}
