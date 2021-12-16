export class OpenAPIExtender {
    static modifySchemas(entry) {
        const [key, val] = entry

        val['properties'] = Object.fromEntries(Object.entries(val['properties']).map(OpenAPIExtender.addFakerField))

        return [key, val]
    }

    static addFakerField(subentry) {
        const [subkey, subval] = subentry
        if (subval['format']) {
            if (subval['format'].startsWith('faker:')) {
                subval['faker'] = subval['format'].split('faker:')[1].trim()
                delete subval['format']
            }
        }
        return [subkey, subval]
    }

    static reformat(document) {
        const schemas = document.components.schemas
        const modifiedSchemas = Object.entries(schemas).map(OpenAPIExtender.modifySchemas)
        document.components.schemas = Object.fromEntries(modifiedSchemas)
        return document
    }
}
