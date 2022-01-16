import { User } from './user.model'
import { Report } from './report.model'
import { Comment } from './comment.model'
import { Team } from './team.model'
import { Organization } from './organization.model'

export class Relations {
    [key: string]: User | Report | Comment | Team | Organization | object | null
}
