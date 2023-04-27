import { File } from '@kyso-io/kyso-model';
import { Injectable, Provider } from '@nestjs/common';
import { AutowiredService } from '../../generic/autowired.generic';
import { FilesMongoProvider } from './providers/mongo-files.provider';

function factory(service: FilesService) {
  return service;
}

export function createFilesProvider(): Provider<FilesService> {
  return {
    provide: `${FilesService.name}`,
    useFactory: (service) => factory(service),
    inject: [FilesService],
  };
}

@Injectable()
export class FilesService extends AutowiredService {
  constructor(private readonly filesMongoProvider: FilesMongoProvider) {
    super();
  }

  public async getFileById(fileId: string): Promise<File> {
    const files: File[] = await this.filesMongoProvider.read({ filter: { _id: this.filesMongoProvider.toObjectId(fileId) } });
    return files.length === 1 ? files[0] : null;
  }
}
