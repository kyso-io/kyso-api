const BASE_URL = `${process.env.SELF_URL}/v1`

export class HateoasLinker {
    static createRef(relativePath) {
        return {
            api: `/v1${relativePath}`,
            ui: relativePath,
        }
    }
}
