export interface PodCreationData {
  phase: string;
  creationTimestamp: Date;
}

export interface SecretCreationData {
  creationTimestamp: Date;
}

export interface CreateBuilderResponse {
  pod: PodCreationData;
  secret: SecretCreationData;
}
