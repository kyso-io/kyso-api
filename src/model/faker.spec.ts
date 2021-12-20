// getting weird import errors with this lib
const jsf = require('json-schema-faker') // eslint-disable-line

jsf.extend('faker', () => require('faker'))

describe('Model test suite', () => {
    test('Create fake comments', async () => {
        const fakeComments = await jsf.resolve({
            type: 'array',
            minItems: 4,
            items: {
                $ref: 'http://localhost:3000/v1-json/#/components/schemas/Comment',
            },
        })

        console.log(fakeComments)
    })
})
