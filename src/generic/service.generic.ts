import { Token } from '@kyso-io/kyso-model';

export interface GenericService<T> {
  /**
   * Checks if the requester has ownership on the item provided
   *
   * An user has ownership on an item if:
   *     * It's the user who created the item
   *     * Has the role PLATFORM_ADMIN or TEAM_ADMIN or ORGANIZATION_ADMIN in the team and organization provided
   */
  checkOwnership(item: T, requester: Token, organizationName: string, teamName: string): Promise<boolean>;
}
