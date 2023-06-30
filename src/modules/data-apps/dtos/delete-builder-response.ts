export interface PodDeletionData {
  deletionTimestamp: Date;
}

export interface SecretDeletionData {
  deletionStatus: string;
}

export interface DeleteBuilderResponse {
  pod: PodDeletionData;
  secret: SecretDeletionData;
}
