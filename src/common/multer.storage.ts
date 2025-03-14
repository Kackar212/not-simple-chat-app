import { diskStorage } from 'multer';

import * as path from 'path';

export const storage = (destination: string) =>
  diskStorage({
    destination: `./public/${destination}`,
    async filename(_req, file, callback) {
      const fileExtension = path.extname(file.originalname).toLowerCase();
      const name = crypto.randomUUID();

      callback(null, `${name}${fileExtension}`);
    },
  });
