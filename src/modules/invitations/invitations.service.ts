import { CreateInvitationDto, Invitation, InvitationStatus, InvitationType, Organization, Team, TeamMember, User } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Injectable, Logger, PreconditionFailedException, Provider } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { KysoSettingsEnum } from '../kyso-settings/enums/kyso-settings.enum'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { InvitationsMongoProvider } from './providers/invitations-mongo.provider'

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

    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService

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
        const frontendUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)
        const invitations: Invitation[] = await this.provider.read({
            filter: {
                email: createInvitationDto.email,
                entity: createInvitationDto.entity,
                entity_id: createInvitationDto.entity_id,
                status: InvitationStatus.Pending,
            },
        })
        if (invitations.length > 0) {
            throw new PreconditionFailedException(`Invitation for ${createInvitationDto.email} of type ${createInvitationDto.entity} already exists`)
        }
        const invitation: Invitation = await this.provider.create({ creator_id: userId, status: InvitationStatus.Pending, ...createInvitationDto })
        switch (invitation.entity) {
            case InvitationType.Team:
                const user: User = await this.usersService.getUserById(invitation.creator_id)
                const team: Team = await this.teamsService.getTeamById(invitation.entity_id)
                const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
                this.mailerService
                    .sendMail({
                        to: invitation.email,
                        subject: `Kyso: New invitation to join team ${team.sluglified_name}`,
                        template: 'invitation-team',
                        context: {
                            user,
                            roles: invitation.payload.roles.map((role: string) => role.replace('-', ' ')).join(','),
                            frontendUrl,
                            organization,
                            team,
                            invitation,
                        },
                    })
                    .then((messageInfo) => {
                        Logger.log(`Invitation mail ${messageInfo.messageId} sent to ${invitation.email}`, UsersService.name)
                    })
                    .catch((err) => {
                        Logger.error(`An error occurrend sending invitation welcome mail to ${invitation.email}`, err, UsersService.name)
                    })
                break
            case InvitationType.Organization:
                break
        }
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

    public async acceptInvitation(userId: string, id: string): Promise<Invitation> {
        const invitation: Invitation = await this.getInvitationById(id)
        if (!invitation) {
            throw new PreconditionFailedException('Invitation not found')
        }
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new PreconditionFailedException('Invalid credentials found')
        }
        if (user.email !== invitation.email) {
            throw new PreconditionFailedException('User email does not match invitation email')
        }
        if (invitation.status !== InvitationStatus.Pending) {
            throw new PreconditionFailedException('Invitation is not pending')
        }
        switch (invitation.entity) {
            case InvitationType.Team:
                const team: Team = await this.teamsService.getTeamById(invitation.entity_id)
                if (!team) {
                    throw new PreconditionFailedException('Team not found')
                }
                const teamMembers: TeamMember[] = await this.teamsService.getMembers(team.id)
                const index: number = teamMembers.findIndex((member: TeamMember) => member.id === user.id)
                if (index > -1) {
                    throw new PreconditionFailedException('User is already member of team')
                }
                await this.teamsService.addMembersById(team.id, [user.id], [...invitation.payload.roles])
                break
            case InvitationType.Organization:
                break
        }
        return this.provider.update({ _id: this.provider.toObjectId(invitation.id) }, { $set: { status: InvitationStatus.Accepted } })
    }

    public async rejectInvitation(userId: string, id: string): Promise<Invitation> {
        const invitation: Invitation = await this.getInvitationById(id)
        if (!invitation) {
            throw new PreconditionFailedException('Invitation not found')
        }
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new PreconditionFailedException('User not found')
        }
        if (user.email !== invitation.email) {
            throw new PreconditionFailedException('User email does not match invitation email')
        }
        if (invitation.status !== InvitationStatus.Pending) {
            throw new PreconditionFailedException('Invitation is not pending')
        }
        return this.provider.update({ _id: this.provider.toObjectId(invitation.id) }, { $set: { status: InvitationStatus.Rejected } })
    }

    public async getInvitationOfUser(userId: string, invitationId: string): Promise<Invitation> {
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new PreconditionFailedException('User not found')
        }
        const invitation: Invitation = await this.getInvitationById(invitationId)
        if (!invitation) {
            throw new PreconditionFailedException('Invitation not found')
        }
        if (invitation.email !== user.email) {
            throw new PreconditionFailedException('The invitation does not belong to this user')
        }
        if (invitation.status !== InvitationStatus.Pending) {
            throw new PreconditionFailedException(
                `The invitation has already been ${invitation.status === InvitationStatus.Accepted ? 'accepted' : 'rejected'}`,
            )
        }
        return invitation
    }
}
