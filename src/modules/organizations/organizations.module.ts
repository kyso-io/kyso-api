import { Module } from '@nestjs/common'
import { UsersModule } from '../users/users.module'
import { OrganizationsController } from './organizations.controller'
import { OrganizationsService } from './organizations.service'
import { OrganizationMemberMongoProvider } from './providers/mongo-organization-member.provider'
import { OrganizationsMongoProvider } from './providers/mongo-organizations.provider'

@Module({
    providers: [OrganizationsService, OrganizationsMongoProvider, OrganizationMemberMongoProvider],
    controllers: [OrganizationsController],
    exports: [OrganizationsService],
})
export class OrganizationsModule {}
