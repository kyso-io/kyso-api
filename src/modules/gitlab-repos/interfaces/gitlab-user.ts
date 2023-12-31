export class GitlabUser {
  id: number;
  username: string;
  name: string;
  state: string;
  avatar_url: string;
  web_url: string;
  created_at: Date;
  bio: string;
  location: string;
  public_email: string;
  skype: string;
  linkedin: string;
  twitter: string;
  website_url: string;
  organization: string;
  job_title: string;
  pronouns: string;
  bot: boolean;
  work_information: null;
  followers: number;
  following: number;
  local_time: string;
  last_sign_in_at: Date;
  confirmed_at: Date;
  last_activity_on: Date;
  email: string;
  theme_id: number;
  color_scheme_id: number;
  projects_limit: number;
  current_sign_in_at: Date;
  identities: Identity[];
  can_create_group: boolean;
  can_create_project: boolean;
  two_factor_enabled: boolean;
  external: boolean;
  private_profile: boolean;
  commit_email: string;
}

export interface Identity {
  provider: string;
  extern_uid: string;
}
