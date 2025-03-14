import { Controller, Get, Query, Req } from '@nestjs/common';
import { stat } from 'fs/promises';

@Controller('/')
export class AppController {
  fileExists(path: string) {
    return stat(`./public/${path}`)
      .then(() => true)
      .catch(() => false);
  }

  @Get('*')
  async getFile(
    @Req() request: Request,
    @Query() query: { format: string; width: string; height: string },
  ) {
    const { pathname } = new URL(request.url);

    const fileExists = await this.fileExists(pathname);

    if (!fileExists) {
      
    }
  }
}
