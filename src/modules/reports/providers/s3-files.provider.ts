import { Injectable, Logger } from '@nestjs/common'
const AWS = require('aws-sdk')
const S3Adapter = require('@parse/s3-files-adapter')
// const MailgunAdapter = require('@parse/simple-mailgun-adapter')

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

        return {
            s3settings
        }
    }
}