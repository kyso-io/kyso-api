export enum KysoSettingsEnum {
    // Cloudfront data
    KYSO_FILES_CLOUDFRONT_URL = 'KYSO_FILES_CLOUDFRONT_URL',
    // Amazon S3 configuration
    AWS_REGION = 'AWS_REGION',
    AWS_S3_BUCKET = 'AWS_S3_BUCKET',
    AWS_ACCESS_KEY_ID = 'AWS_ACCESS_KEY_ID',
    AWS_SECRET_ACCESS_KEY = 'AWS_SECRET_ACCESS_KEY',
    // Bitbucket configuration
    AUTH_BITBUCKET_CLIENT_ID = 'AUTH_BITBUCKET_CLIENT_ID',
    AUTH_BITBUCKET_CLIENT_SECRET = 'AUTH_BITBUCKET_CLIENT_SECRET',
    BITBUCKET_API = 'BITBUCKET_API',
    // Github configuration
    AUTH_GITHUB_CLIENT_ID = 'AUTH_GITHUB_CLIENT_ID',
    AUTH_GITHUB_CLIENT_SECRET = 'AUTH_GITHUB_CLIENT_SECRET',
    // Google configuration
    AUTH_GOOGLE_CLIENT_ID = 'AUTH_GOOGLE_CLIENT_ID',
    AUTH_GOOGLE_CLIENT_SECRET = 'AUTH_GOOGLE_CLIENT_SECRET',
    // Gitlab configuration
    AUTH_GITLAB_CLIENT_ID = 'AUTH_GITLAB_CLIENT_ID',
    AUTH_GITLAB_CLIENT_SECRET = 'AUTH_GITLAB_CLIENT_SECRET',
    AUTH_GITLAB_REDIRECT_URI = 'AUTH_GITLAB_REDIRECT_URI',
    /* Needed to build a webhook with github. Needs to be a public URL as well,
     * because Github don't allow you to make a webhook vs localhost for security :()
     */
    BASE_URL = 'BASE_URL',
    // Outcoming mail configuration
    MAIL_TRANSPORT = 'MAIL_TRANSPORT',
    MAIL_FROM = 'MAIL_FROM',
    FRONTEND_URL = 'FRONTEND_URL',
    // Sftp configuration
    SFTP_HOST = 'SFTP_HOST',
    SFTP_PORT = 'SFTP_PORT',
    SFTP_USERNAME = 'SFTP_USERNAME',
    SFTP_PASSWORD = 'SFTP_PASSWORD',
    SFTP_DESTINATION_FOLDER = 'SFTP_DESTINATION_FOLDER',
    // SCS path
    STATIC_CONTENT_PREFIX = 'STATIC_CONTENT_PREFIX',
    // Reports path
    REPORT_PATH = 'REPORT_PATH',
    // Internal elasticsearch url
    ELASTICSEARCH_URL = 'ELASTICSEARCH_URL',
    // FRONTEND_URL
    // Verification email duration
    DURATION_HOURS_TOKEN_EMAIL_VERIFICATION = 'DURATION_HOURS_TOKEN_EMAIL_VERIFICATION',
}

export function getKysoSettingDefaultValue(setting: KysoSettingsEnum) {
    switch (setting) {
        case KysoSettingsEnum.BITBUCKET_API:
            return 'https://api.bitbucket.org/2.0'
        case KysoSettingsEnum.BASE_URL:
            return 'http://localhost.kyso.io:4000'
        case KysoSettingsEnum.FRONTEND_URL:
            return 'http://localhost:3000'
        case KysoSettingsEnum.KYSO_FILES_CLOUDFRONT_URL:
            return 'https://d1kser01wv8mbw.cloudfront.net'
        case KysoSettingsEnum.AWS_REGION:
            return 'us-east-1'
        case KysoSettingsEnum.MAIL_TRANSPORT:
            return 'smtps://dev@dev.kyso.io:sphere6wrap&toxic@mailu.kyso.io'
        case KysoSettingsEnum.MAIL_FROM:
            return '"kyso" <dev@dev.kyso.io>'
        case KysoSettingsEnum.ELASTICSEARCH_URL:
            return 'http://elasticsearch-master.elasticsearch-lo.svc.cluster.local:9200'
        case KysoSettingsEnum.DURATION_HOURS_TOKEN_EMAIL_VERIFICATION:
            return '2'
        default:
            return ''
    }
}

export function getKysoSettingDescription(setting: KysoSettingsEnum) {
    switch (setting) {
        case KysoSettingsEnum.KYSO_FILES_CLOUDFRONT_URL:
            return 'Cloudfront service for Kyso'
        case KysoSettingsEnum.AWS_REGION:
            return 'AWS Region in which this instance of Kyso will operate. i.e: us-east-1'
        case KysoSettingsEnum.AWS_S3_BUCKET:
            return "Name of the AWS S3 Bucket which will store Kyso's data. i.e: kyso-user-files-east"
        case KysoSettingsEnum.AWS_ACCESS_KEY_ID:
            return 'Access Key Identificator por AWS S3'
        case KysoSettingsEnum.AWS_SECRET_ACCESS_KEY:
            return 'Secret to connect to AWS S3'
        case KysoSettingsEnum.AUTH_BITBUCKET_CLIENT_ID:
            return 'Client ID used for OAUTH2 authentication using Bitbucket provider'
        case KysoSettingsEnum.AUTH_BITBUCKET_CLIENT_SECRET:
            return 'Secret used for OAUTH2 authentication using Bitbucket provider'
        case KysoSettingsEnum.AUTH_GITHUB_CLIENT_ID:
            return 'Client ID used for OAUTH2 authentication using Github provider'
        case KysoSettingsEnum.AUTH_GITHUB_CLIENT_SECRET:
            return 'Secret used for OAUTH2 authentication using Github provider'
        case KysoSettingsEnum.AUTH_GOOGLE_CLIENT_ID:
            return 'Client ID used for OAUTH2 authentication using Google provider'
        case KysoSettingsEnum.AUTH_GOOGLE_CLIENT_SECRET:
            return 'Secret used for OAUTH2 authentication using Google provider'
        case KysoSettingsEnum.AUTH_GITLAB_CLIENT_ID:
            return 'Client ID used for OAUTH2 authentication using Gitlab provider'
        case KysoSettingsEnum.AUTH_GITLAB_CLIENT_SECRET:
            return 'Secret used for OAUTH2 authentication using Gitlab provider'
        case KysoSettingsEnum.AUTH_GITLAB_REDIRECT_URI:
            return 'Redirect URI used for OAUTH2 authentication using Gitlab provider'
        case KysoSettingsEnum.KYSO_FILES_CLOUDFRONT_URL:
            return 'https://d1kser01wv8mbw.cloudfront.net'
        case KysoSettingsEnum.BASE_URL:
            return "Public frontend url, needed to build a webhook with github. Needs to be a public URL as well, because Github don't allow you to make a webhook vs localhost for security reasons"
        case KysoSettingsEnum.MAIL_TRANSPORT:
            return 'SMTP mail transport using the following format: smtps://USER:PASSWORD@smtp.googlemail.com'
        case KysoSettingsEnum.MAIL_FROM:
            return `Sender name and email which will send emails in name of Kyso. i.e: "kyso" <noreply@kyso.io>`
        case KysoSettingsEnum.FRONTEND_URL:
            return `Frontend URL`
        case KysoSettingsEnum.SFTP_HOST:
            return `SFTP host`
        case KysoSettingsEnum.SFTP_PORT:
            return `SFTP port`
        case KysoSettingsEnum.SFTP_USERNAME:
            return `SFTP username`
        case KysoSettingsEnum.SFTP_PASSWORD:
            return `SFTP password`
        case KysoSettingsEnum.SFTP_DESTINATION_FOLDER:
            return `SFTP destination folder`
        case KysoSettingsEnum.STATIC_CONTENT_PREFIX:
            return `Static content prefix`
        case KysoSettingsEnum.REPORT_PATH:
            return `Path where reports are unzipped`
        case KysoSettingsEnum.ELASTICSEARCH_URL:
            return `Internal Kubernetes URL for Elasticsearch`
        case KysoSettingsEnum.DURATION_HOURS_TOKEN_EMAIL_VERIFICATION:
            return `Duration in hours for token email verification`
        default:
            return 'No description provided'
    }
}
