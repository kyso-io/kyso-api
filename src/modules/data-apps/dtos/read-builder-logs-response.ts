export interface ContainerLogData {
  name: string;
  log: string;
}

export interface ReadBuilderLogsResponse {
  phase: string;
  initContainers: ContainerLogData[];
  containers: ContainerLogData[];
}
