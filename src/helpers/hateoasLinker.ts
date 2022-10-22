export class HateoasLinker {
  static createRef(relativePath) {
    return {
      api: `/v1${relativePath}`,
      ui: relativePath,
    };
  }
}
