import { KysoEventEnum } from '@kyso-io/kyso-model';
import { Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import * as moment from 'moment';
import { v4 as uuidv4 } from 'uuid';

export class NATSHelper {
  static safelyEmit<T>(client: ClientProxy, event: KysoEventEnum, payload: any) {
    try {
      client.emit<T>(event, { uuid: uuidv4(), date: moment().utc().toDate(), ...payload });
    } catch (ex) {
      Logger.warn(`Event ${event} not sent to NATS`);
    }
  }
}
