import { Normalizer } from './normalizer'

// getting weird import errors with this lib
const jsf = require('json-schema-faker') // eslint-disable-line

jsf.extend('faker', () => require('faker'))

describe('Normalizer test suite', () => {
    test('Create fake comments and normalize', async () => {
        const fakeComments = await jsf.resolve({
            type: 'array',
            minItems: 4,
            items: {
                $ref: 'http://localhost:3000/v1-json/#/components/schemas/Comment',
            },
        })

        const normalizedComments = Normalizer.normalizeComments({ comments: fakeComments })
        expect(normalizedComments.result.comments).toStrictEqual(fakeComments.map((f) => f.id))
    })
})
