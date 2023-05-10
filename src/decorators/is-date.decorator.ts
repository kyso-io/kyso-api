import { ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';
import * as moment from 'moment';

export function IsDate(format: string, validationOptions?: ValidationOptions) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'IsDate',
      target: object.constructor,
      propertyName: propertyName,
      // constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          return typeof value === 'string' && moment(value, format, true).isValid();
        },
      },
    });
  };
}
