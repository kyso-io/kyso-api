import { Injectable, Provider } from '@nestjs/common';
import { AutowiredService } from '../../generic/autowired.generic';
import { UserRoleMongoProvider } from './providers/mongo-user-role.provider';

function factory(service: UserRoleService) {
  return service;
}

export function createUserRoleProvider(): Provider<UserRoleService> {
  return {
    provide: `${UserRoleService.name}`,
    useFactory: (service) => factory(service),
    inject: [UserRoleService],
  };
}

@Injectable()
export class UserRoleService extends AutowiredService {
  constructor(private readonly userRoleMongoProvider: UserRoleMongoProvider) {
    super();
  }

  public async getRolesByUser(userId: string): Promise<any[]> {
    return await this.userRoleMongoProvider.read({ filter: { userId: userId } });
  }
}
