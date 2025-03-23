import { Controller, Get, Next, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { SessionGuard } from 'src/common';

const proxy = createProxyMiddleware({
  changeOrigin: true,
  target: process.env.TENOR_API_BASE_URL,
  pathRewrite(path: string) {
    return path.replace('/api/gifs', '');
  },
  logger: console,
});

@Controller('api/gifs')
export class ExternalController {
  constructor(private readonly configService: ConfigService) {}

  @Get('*')
  @UseGuards(SessionGuard)
  tenorApi(@Req() req: Request, @Next() next: NextFunction) {
    const url = new URL(req.url, this.configService.get('APP_URL'));
    url.searchParams.set('key', this.configService.get('TENOR_API_KEY')!);
    url.searchParams.set('limit', '50');
    url.searchParams.set('media_filter', 'tinymp4');

    req.url = `${url.pathname}${url.search}`;

    proxy(req, req.res!, next);
  }
}
