import { CreateInvitationDto, Invitation, InvitationStatus, InvitationType, Team, User } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Injectable, Logger, PreconditionFailedException, Provider } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { OrganizationsService } from '../organizations/organizations.service'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { InvitationsMongoProvider } from './providers/Invitations-mongo.provider'

function factory(service: InvitationsService) {
    return service
}

export function createProvider(): Provider<InvitationsService> {
    return {
        provide: `${InvitationsService.name}`,
        useFactory: (service) => factory(service),
        inject: [InvitationsService],
    }
}

@Injectable()
export class InvitationsService extends AutowiredService {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    constructor(private mailerService: MailerService, private readonly provider: InvitationsMongoProvider) {
        super()
    }

    public async getInvitationById(id: string): Promise<Invitation> {
        return this.getInvitation({ filter: { _id: this.provider.toObjectId(id) } })
    }

    public async getInvitation(query: any): Promise<Invitation> {
        const invitations: Invitation[] = await this.provider.read(query)
        if (invitations.length === 0) {
            return null
        }
        return invitations[0]
    }

    public async getInvitations(query: any): Promise<Invitation[]> {
        return this.provider.read(query)
    }

    public async updateInvitation(filterQuery: any, updateQuery: any): Promise<Invitation> {
        return this.provider.update(filterQuery, updateQuery)
    }

    public async createInvitation(userId: string, createInvitationDto: CreateInvitationDto): Promise<Invitation> {
        const invitations: Invitation[] = await this.provider.read({
            filter: {
                email: createInvitationDto.email,
                entity: createInvitationDto.entity,
                entity_id: createInvitationDto.entity_id,
            },
        })
        if (invitations.length > 0) {
            throw new PreconditionFailedException(`Invitation for ${createInvitationDto.email} of type ${createInvitationDto.entity} already exists`)
        }
        const invitation: Invitation = await this.provider.create({ creator_id: userId, ...createInvitationDto })
        let subject = null
        let html = null
        switch (invitation.entity) {
            case InvitationType.Team:
                const user: User = await this.usersService.getUserById(invitation.creator_id)
                const team: Team = await this.teamsService.getTeamById(invitation.entity_id)
                subject = `Kyso: New invitation to join team ${team.name}`
                html = `User ${user.nickname} has invited you to join the team ${team.name} with the role ${invitation.payload.roles
                    .map((role: string) => role.replace('-', ' '))
                    .join(',')
                    .toUpperCase()}`
                break
            case InvitationType.Organization:
                break
        }
        this.mailerService
            .sendMail({
                to: invitation.email,
                subject,
                html,
            })
            .then(() => {
                Logger.log(`Invitation mail sent to ${invitation.email}`, UsersService.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending invitation welcome mail to ${invitation.email}`, err, UsersService.name)
            })
        return invitation
    }

    public async deleteInvitation(invitationId: string): Promise<Invitation> {
        const invitation: Invitation = await this.getInvitationById(invitationId)
        if (!invitation) {
            throw new PreconditionFailedException('Invitation not found')
        }
        await this.provider.deleteOne({ _id: this.provider.toObjectId(invitationId) })
        return invitation
    }

    public async acceptInvitation(id: string): Promise<Invitation> {
        const invitation: Invitation = await this.getInvitationById(id)
        if (!invitation) {
            throw new PreconditionFailedException('Invitation not found')
        }
        const user: User = await this.usersService.getUser({ filter: { email: invitation.email } })
        if (!user) {
            throw new PreconditionFailedException('User not registered found')
        }
        switch (invitation.entity) {
            case InvitationType.Team:
                const team: Team = await this.teamsService.getTeamById(invitation.entity_id)
                if (!team) {
                    throw new PreconditionFailedException('Team not found')
                }
                await this.teamsService.addMembersById(team.id, [user.id], [...invitation.payload.roles])
                break
            case InvitationType.Organization:
                break
        }
        return this.provider.update({ _id: this.provider.toObjectId(invitation.id) }, { $set: { status: InvitationStatus.Accepted } })
    }

    public async rejectInvitation(id: string): Promise<Invitation> {
        const invitation: Invitation = await this.getInvitationById(id)
        if (!invitation) {
            throw new PreconditionFailedException('Invitation not found')
        }
        return this.provider.update({ _id: this.provider.toObjectId(invitation.id) }, { $set: { status: InvitationStatus.Rejected } })
    }
}
