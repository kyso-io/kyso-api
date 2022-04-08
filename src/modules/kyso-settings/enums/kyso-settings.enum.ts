import { KysoSettingsEnum } from "@kyso-io/kyso-model"

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
        case KysoSettingsEnum.DURATION_MINUTES_TOKEN_RECOVERY_PASSWORD:
            return '15'
        case KysoSettingsEnum.RECAPTCHA2_ENABLED:
            return 'false'
        case KysoSettingsEnum.RECAPTCHA2_SITE_KEY:
            // Development default's https://developers.google.com/recaptcha/docs/faq#id-like-to-run-automated-tests-with-recaptcha.-what-should-i-do
            return '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'
        case KysoSettingsEnum.RECAPTCHA2_SECRET_KEY:
            // Development default's https://developers.google.com/recaptcha/docs/faq#id-like-to-run-automated-tests-with-recaptcha.-what-should-i-do
            return '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe'
        
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
        case KysoSettingsEnum.RECAPTCHA2_ENABLED:
            return `Enables recaptcha globally in the platform`
        case KysoSettingsEnum.DURATION_MINUTES_TOKEN_RECOVERY_PASSWORD:
            return `Duration in minutes for token recovery password`
        case KysoSettingsEnum.RECAPTCHA2_SITE_KEY:
            return `Recaptcha2 site key`
        case KysoSettingsEnum.RECAPTCHA2_SECRET_KEY:
            return `Recaptcha2 secret key`
        case KysoSettingsEnum.SERVICE_DESK_EMAIL:
            return `Service desk email`
        default:
            return 'No description provided'
    }
}
