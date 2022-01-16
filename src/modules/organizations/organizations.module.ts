import { DynamicModule, Module } from '@nestjs/common'
import { OrganizationsController } from './organizations.controller'
import { createProvider, OrganizationsService } from './organizations.service'
import { OrganizationMemberMongoProvider } from './providers/mongo-organization-member.provider'
import { OrganizationsMongoProvider } from './providers/mongo-organizations.provider'

/*
@Module({
    providers: [OrganizationsService, OrganizationsMongoProvider, OrganizationMemberMongoProvider],
    controllers: [OrganizationsController],
    exports: [OrganizationsService],
})*/
export class OrganizationsModule {
    static forRoot(): DynamicModule {
        const dynamicProvider = createProvider();
   
        return {
            module: OrganizationsModule,
            providers: [OrganizationsService, OrganizationsMongoProvider, OrganizationMemberMongoProvider, dynamicProvider],
            controllers: [OrganizationsController],
            exports: [dynamicProvider],
          
        };
    }
}
