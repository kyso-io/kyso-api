import { Normalizer } from './normalizer'

// getting weird import errors with this lib
const jsf = require('json-schema-faker') // eslint-disable-line

jsf.extend('faker', () => require('faker'))

describe('Normalizer test suite', () => {
    test('Get schemas and normalize', async () => {
        const faked = await jsf.resolve({
            type: 'object',
            properties: {
                type: 'object',
                minItems: 1,
                $ref: 'https://staging.api.kyso.io/v1-json/#/components/schemas/Comment',
            },
        })

        const normalizedResponse = Normalizer.normalizeResponse(faked)
        console.log(JSON.stringify(faked, null, 2))
        console.log(JSON.stringify(normalizedResponse, null, 2))
    })
})
