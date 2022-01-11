import { OnApplicationBootstrap } from "@nestjs/common";
import { registerSingleton } from "../decorators/autowired";

export abstract class AutowiredService implements OnApplicationBootstrap {  
    onApplicationBootstrap() {
        registerSingleton(this.constructor.name, this)
    }
}
