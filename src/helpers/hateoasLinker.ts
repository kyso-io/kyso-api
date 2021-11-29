const BASE_URL = `${process.env.SELF_URL}/v1`

export class HateoasLinker {
    static createRef(relativePath) {
        return {
            api: `${BASE_URL}${relativePath}`,
            ui: relativePath,
        }
    }
}
