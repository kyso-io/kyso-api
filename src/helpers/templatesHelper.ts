import path, { join } from 'path';

export const MAIL_TEMPLATES_PATH = join(__dirname, 'templates/');

// a helper function which generates the full path to the mail template
export const getFullTemplatePath = (templatePath: string): string => {
    return path.resolve(MAIL_TEMPLATES_PATH, ...templatePath.split("/"))
}