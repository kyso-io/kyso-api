import { normalize, schema } from 'normalizr'

const user = new schema.Entity('users')

const comment = new schema.Entity('comments', { user: user })
const comments = new schema.Array(comment)
comment.define({ comments })

export class Normalizer {
    static normalizeComments(proposed) {
        const normalized = normalize(proposed, { comments: [comment] })
        return normalized
    }
}
