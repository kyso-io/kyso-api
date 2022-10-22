import { Logger, Type } from '@nestjs/common';

const singletonMap = new Map<string, any>();

export const registerSingleton = (name: any, object: any) => {
  singletonMap.set(name, object);
};

export const getSingletons = () => {
  return Array.from(singletonMap.keys());
};

export const getSingletonValue = (key) => {
  return singletonMap.get(key);
};

type TModel = Type<any>;

export class AutowiredConfiguration {
  type?: TModel;
  typeName?: string;
}

export const Autowired = (config: AutowiredConfiguration) => {
  return (target: any, memberName: string) => {
    Object.defineProperty(target, memberName, {
      get: () => {
        if (config && config.type && config.type.name) {
          return singletonMap.get(config.type.name);
        } else if (config && config.typeName) {
          if (singletonMap.has(config.typeName)) {
            return singletonMap.get(config.typeName);
          } else {
            Logger.warn(`[AUTOWIRED] typeName ${config.typeName} does not exist in Autowired services`);
            return undefined;
          }
        } else {
          Logger.warn(`[AUTOWIRED] Received type and typeName undefined for target ${target.constructor.name}. Returning undefined`);
          return undefined;
        }
      },
    });
  };
};
