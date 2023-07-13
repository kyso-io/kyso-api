import { Comment, NormalizedResponseDTO, Organization, Report, Team, User } from '@kyso-io/kyso-model';
import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

const MODELS: any[] = [
  { key: 'comment', value: Comment },
  { key: 'organization', value: Organization },
  { key: 'report', value: Report },
  { key: 'team', value: Team },
  { key: 'user', value: User },
];

const relations: any = {
  type: 'object',
  properties: {},
};
MODELS.forEach((model) => {
  relations.properties[model.key] = {
    type: 'object',
    additionalProperties: { type: 'object', $ref: getSchemaPath(model.value) },
  };
});

export const ApiNormalizedResponse = <TModel extends Type<any>>(args: { status: number; description: string; type: TModel; isArray?: boolean }) => {
  let data: any;
  if (args.isArray) {
    data = {
      type: 'array',
      items: { $ref: getSchemaPath(args.type) },
    };
  } else {
    data = {
      $ref: getSchemaPath(args.type),
    };
  }
  return applyDecorators(
    ApiExtraModels(NormalizedResponseDTO, args.type),
    ApiOkResponse({
      status: args.status,
      description: args.description,
      schema: {
        properties: { data, relations },
      },
    }),
  );
};
