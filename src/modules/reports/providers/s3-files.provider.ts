import { KysoSettingsEnum } from '@kyso-io/kyso-model'
import { Injectable } from '@nestjs/common'
import { Autowired } from '../../../decorators/autowired'
import { KysoSettingsService } from '../../kyso-settings/kyso-settings.service'
const AWS = require('aws-sdk')

@Injectable()
export class FilesS3Provider {
    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService
   
    constructor() { }

    async getFile(fileName) {
        const s3Client = await this.connectS3()
        const res = await s3Client.getObject({ Key: fileName }).promise()
        return Buffer.from(res.Body, 'base64')
    }

    private async connectS3(): Promise<any> {
        const awsRegion = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_REGION)
        const cloudFrontUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.KYSO_FILES_CLOUDFRONT_URL)
        const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)

        const s3settings = {
            bucket: s3Bucket,
            region: awsRegion,
            globalCacheControl: 'public, max-age=86400',
            directAccess: true,
            baseUrl: cloudFrontUrl
        }

        return new AWS.S3({
            params: { Bucket: s3settings.bucket },
            region: s3settings.region,
            signatureVersion: 'v4',
            globalCacheControl: s3settings.globalCacheControl,
        })
    }
}