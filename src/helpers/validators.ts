export class Validators {
  static isValidSha(hash) {
    return /^[0-9a-f]{40}/i.test(hash);
  }

  static isValidReportName(name) {
    return /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.test(name);
  }
}
