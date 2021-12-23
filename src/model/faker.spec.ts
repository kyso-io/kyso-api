// getting weird import errors with this lib
const jsf = require('json-schema-faker') // eslint-disable-line

jsf.extend('faker', () => require('faker'))

describe('Model test suite', () => {
    test('Create fake report', async () => {
        const fakeReport = await jsf.resolve({
            report: {
                $ref: 'http://localhost:3000/v1-json/#/components/schemas/Report',
            },
        })

        console.log(JSON.stringify(fakeReport, null, 2))
    })
})
