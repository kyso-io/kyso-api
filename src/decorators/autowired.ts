import { Type } from '@nestjs/common'

const singletonMap = new Map<string, any>()

export const registerSingleton = (name: any, object: any) => {
    singletonMap.set(name, object)
}

export const getSingletons = () => {
    return Array.from(singletonMap.keys())
}

export const getSingletonValue = (key) => {
    return singletonMap.get(key)
}

export const Autowired = <TModel extends Type<any>>(type: TModel) => {
    return (target: any, memberName: string) => {
        Object.defineProperty(target, memberName, {
            get: () => singletonMap.get(type.name)
        });
    }
}