import { normalize, schema } from 'normalizr'

const comments = new schema.Entity('comments')

export class Normalizer {
    static normalizeResponse(proposedResponse) {
        const normalizedResponse = normalize(proposedResponse, comments)
        return normalizedResponse
    }
}
