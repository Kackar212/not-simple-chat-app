import { UploadDestination } from 'src/common/constants';

export type Destinations =
  (typeof UploadDestination)[keyof typeof UploadDestination];
