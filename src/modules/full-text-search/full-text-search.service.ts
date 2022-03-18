import { Injectable } from '@nestjs/common'
import { AutowiredService } from '../../generic/autowired.generic'

@Injectable()
export class FullTextSearchService extends AutowiredService {
    constructor() {
        super()
    }
}
