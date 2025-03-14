import { HttpStatus } from '@nestjs/common';

export interface Response<Data> {
  message: string;
  data: Data;
  statusCode: HttpStatus;
}
