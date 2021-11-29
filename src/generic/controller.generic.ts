import { ApiResponse } from '@nestjs/swagger';

@ApiResponse({ status: 400, description: `Input is not correct`, type: Error })
@ApiResponse({
  status: 401,
  description: `You need to be authenticated to execute this action`,
  type: Error,
})
@ApiResponse({
  status: 404,
  description: `The resource you are trying to acces can't be found`,
  type: Error,
})
@ApiResponse({
  status: 403,
  description: `You are not allowed to perform this action`,
  type: Error,
})
@ApiResponse({ status: 500, description: `Internal Error`, type: Error })
export abstract class GenericController<T> {
  abstract assignReferences(item: T);
}
