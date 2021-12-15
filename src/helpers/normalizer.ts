import { normalize, schema } from 'normalizr'

const comment = new schema.Entity('comments')

export class Normalizer {
    static normalizeComments(proposed) {
        const normalized = normalize(proposed, { comments: [comment] })
        return normalized
    }
}
