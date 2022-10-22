import { Comment, Organization, Report, Team, User } from '@kyso-io/kyso-model';
import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

const MODELS = [User, Report, Comment, Team, Organization];

export const ApiNormalizedResponse = <TModel extends Type<any>>(args: { status: number; description: string; type: TModel; isArray?: boolean }) => {
  let data: object = {
    $ref: getSchemaPath(args.type),
  };

  if (args.isArray) {
    data = {
      type: 'array',
      items: {
        $ref: getSchemaPath(args.type),
      },
    };
  }

  const relations = {
    anyOf: [...MODELS.map((model) => ({ type: 'object', additionalProperties: { $ref: getSchemaPath(model) } }))],
  };

  return applyDecorators(
    ApiOkResponse({
      status: args.status,
      description: args.description,
      schema: {
        properties: { data, relations },
      },
    }),
  );
};
