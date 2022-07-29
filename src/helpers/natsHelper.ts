import { KysoEvent } from "@kyso-io/kyso-model";
import { Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";

export class NATSHelper {
    static safelyEmit<T>(client: ClientProxy, event: KysoEvent, payload: any) {
        // ATTENTION: ALWAYS SURROUND A NATS CALL IN A TRY CATCH. Nobody wants to broke an APP because 
        // the NATS fails...
        try {
            client.emit<T>(event, payload);
        } catch(ex) {
            Logger.warn(`Event ${event} not sent to NATS`);
        }
    }
}
