export interface DeploymentCreationData {
  creationTimestamp: Date;
}

export interface IngressCreationData {
  creationTimestamp: Date;
}

export interface ServiceCreationData {
  creationTimestamp: Date;
}

export interface CreateDeploymentResponse {
  deployment: DeploymentCreationData;
  ingress: IngressCreationData;
  service: ServiceCreationData;
}
