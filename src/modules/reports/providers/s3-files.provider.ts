import { Injectable, Logger } from '@nestjs/common'
const AWS = require('aws-sdk')
const S3Adapter = require('@parse/s3-files-adapter')
const MailgunAdapter = require('@parse/simple-mailgun-adapter')

const bucket = process.env.AWS_S3_BUCKET

@Injectable()
export class FilesS3Provider {
    settings: any
    client: any
    constructor() {
        this.settings = this.getParseConfig().s3settings
        this.client = new AWS.S3({
            params: { Bucket: this.settings.bucket },
            region: this.settings.region,
            signatureVersion: 'v4',
            globalCacheControl: this.settings.globalCacheControl,
        })
    }

    async getFile(fileName) {
        const res = await this.client.getObject({ Key: fileName }).promise()
        return Buffer.from(res.Body, 'base64')
    }

    private getParseConfig(): any {
        const s3settings = {
            bucket,
            region: process.env.AWS_REGION,
            globalCacheControl: 'public, max-age=86400',
            directAccess: true,
            baseUrl: process.env.KYSO_FILES_CLOUDFRONT_URL,
        }

        let emailAdapter = {}

        if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_EMAIL_DOMAIN) {
            emailAdapter = MailgunAdapter({
                fromAddress: 'support@kyso.io',
                apiKey: process.env.MAILGUN_API_KEY,
                domain: process.env.MAILGUN_EMAIL_DOMAIN,
            })
        } else {
            emailAdapter = EmptyMailAdapter
        }

        return {
            databaseURI: process.env.DATABASE_URI,
            appName: 'Kyso.io',
            appId: process.env.PARSE_APP_ID || 'api-kyso-io',
            masterKey: process.env.PARSE_MASTER_KEY,
            serverURL: `${process.env.SELF_URL}/parse`,
            maxUploadSize: '50000000mb',
            filesAdapter: new S3Adapter(s3settings),
            verifyUserEmails: true,
            emailAdapter,
            emailVerifyTokenValidityDuration: 24 * 60 * 60,
            protectedFields: {
                _User: {
                    '*': ['email', 'accessToken'],
                },
            },
            verbose: false,
            s3settings,
            bucket,
            logLevel: 'error',
            loggerAdapter: EmptyLoggerAdapter,
            logsFolder: null,
            silent: true,
            publicServerURL: `${process.env.SELF_URL}/parse`,
        }
    }
}

class EmptyLoggerAdapter {
    constructor(options) {} // eslint-disable-line
    log(level, message) {} // eslint-disable-line
}

class EmptyMailAdapter {
    constructor(options) {} // eslint-disable-line
    sendMail(options) {} // eslint-disable-line
}
