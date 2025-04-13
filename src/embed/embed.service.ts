import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { randomUUID } from 'crypto';
import { writeFile } from 'fs/promises';
import {
  convertVideo,
  createPlaceholder,
  createPoster,
  PrismaService,
  UploadDestination,
} from 'src/common';
import { ffprobe } from 'fluent-ffmpeg-7';
import path from 'path';
import axios from 'axios';
import jsdom from 'jsdom';
import sharp from 'sharp';
import { PRISMA_INJECTION_TOKEN } from 'src/common/prisma/prisma.module';

const fileTypeFromBuffer = import('file-type').then(
  (lib) => lib.fileTypeFromBuffer,
);

interface TenorGif {
  content_description: string;
  content_description_source: string;
  created: number;
  flags: string[];
  hasaudio: boolean;
  id: `${number}`;
  itemurl: string;
  media_formats: Record<
    string,
    {
      dims: number[];
      url: string;
      size: number;
      preview: string;
      duration: number;
    }
  >;
  tags: string[];
  title: string;
  url: string;
}

interface GiphyGif {
  images: {
    fixed_width_small_still: {
      url: string;
    };
    original: {
      width: string;
      height: string;
    };
    downsized_small: {
      mp4: string;
    };
  };
}

interface Link {
  type: string;
  value: string;
  isLink: boolean;
  href: string;
  start: number;
  end: number;
}

type EmbedMedia = {
  type: 'image' | 'gif' | 'video';
  format: string;
  width: number;
  height: number;
  url: string;
  originalUrl: string;
  isSpoiler: boolean;
  poster?: string;
};

type EmbedLink = {
  type: 'link';
  title: string;
  description: string;
  image: string;
  siteName: string;
  url: string;
  originalUrl: string;
};

const userAgents = [
  'Mozilla/5.0 (Windows NT 11.0; Win86; x86) AppleWebKit/527.16 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/527.16',
  'Mozilla/6.0 (Windows NT 7.6; Win64; x64) AppleWebKit/507.66 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/507.66',
  'Mozilla/4.0 (Windows NT 5.1; Win64; x64) AppleWebKit/557.96 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/570.32',
  'Mozilla/7.0 (Windows NT 10.3; Win86; x86) AppleWebKit/570.32 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/10.0 (Windows NT 6.1; Win64; x64) AppleWebKit/499.31 (KHTML, like Gecko) Chrome/99.0.0.0 Safari/499.31',
  'Mozilla/2.0 (Windows NT 6.0; Win64; x64) AppleWebKit/487.06 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
  'Mozilla/3.0 (Windows NT 8.3; Win86; x86) AppleWebKit/389.43 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/389.43',
];

const getUserAgent = () => {
  const index = Math.floor(Math.random() * userAgents.length);

  return userAgents[index];
};

const SCRAPE_API = 'https://api.scraperapi.com/';
const TENOR_ID_URL = 'https://tenor.com/view/';
const GIPHY_ID_URL = 'https://giphy.com/gifs/';

const createScrapeApiUrl = (apiKey: string, targetUrl: string) => {
  const url = new URL('', SCRAPE_API);

  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('url', targetUrl);

  url.search = url.searchParams.toString();

  return url.toString();
};

@Injectable()
export class EmbedService {
  #concurentRequests = 0;

  constructor(
    private readonly config: ConfigService,
    @Inject(PRISMA_INJECTION_TOKEN)
    private readonly prisma: PrismaService,
  ) {}

  async createEmbeds(links: Link[]): Promise<Array<{ embedId: number }>> {
    const hrefs = links.map(({ href }) => href);

    const existingEmbeds = await this.getExistingEmbeds(hrefs);

    const embeds = await Promise.all(
      this.filterLinks(links, existingEmbeds).map(this.createEmbed.bind(this)),
    );

    const newEmbedsData = embeds.filter(
      (embed): embed is EmbedMedia | EmbedLink => Boolean(embed),
    );

    const newEmbeds = await this.prisma.embed.createManyAndReturn({
      data: newEmbedsData,
      select: {
        id: true,
      },
    });

    return [...newEmbeds, ...existingEmbeds].map(({ id: embedId }) => ({
      embedId,
    }));
  }

  async getTenorGifPlaceholder(gif: TenorGif) {
    const { url } = gif.media_formats.nanogifpreview;

    return url;
  }

  async getGiphyGifPlaceholder(gif: GiphyGif) {
    const {
      fixed_width_small_still: { url },
    } = gif.images;

    return url;
  }

  getGifPlaceholder(gif: TenorGif | GiphyGif) {
    if ('media_formats' in gif) {
      return this.getTenorGifPlaceholder(gif);
    }

    return this.getGiphyGifPlaceholder(gif);
  }

  async fetchGif(
    gifId: string,
    originalUrl: string,
    isSpoiler: boolean,
    provider: 'TENOR' | 'GIPHY',
  ) {
    const pathname = provider === 'TENOR' ? 'posts' : `gifs/${gifId}`;
    const apiKeyName = provider === 'TENOR' ? 'key' : 'api_key';

    const url = new URL(pathname, this.config.get(`${provider}_API_BASE_URL`)!);

    url.searchParams.set(apiKeyName, this.config.get(`${provider}_API_KEY`)!);
    url.searchParams.set('ids', gifId);
    url.searchParams.set('media_filter', 'tinymp4,nanogifpreview');

    console.log(url);

    const { data } = await axios.get<
      { results: Array<TenorGif> } | { data: GiphyGif }
    >(url.toString());

    const result = 'results' in data ? data.results[0] : data.data;

    return this.createEmbedGif(originalUrl, isSpoiler, result);
  }

  async createEmbed(link: Link): Promise<EmbedMedia | EmbedLink | undefined> {
    let url = link.href;

    const isAppUrl = url.startsWith(this.config.get('APP_URL')!);

    console.log(link);
    const scrapeApiUrl = createScrapeApiUrl(
      this.config.get('SCRAPE_API_KEY')!,
      url,
    );

    try {
      const isSpoiler = url.includes('__SPOILER__');

      const parsedUrl = new URL(url);

      url = parsedUrl.toString();

      const gifId = parsedUrl.pathname.split('-').pop();

      const hasTenorGifId =
        link.href.startsWith(TENOR_ID_URL) && !Number.isNaN(Number(gifId));
      const hasGiphyGifId = link.href.startsWith(GIPHY_ID_URL) && gifId;

      if (hasTenorGifId || hasGiphyGifId) {
        return this.fetchGif(
          gifId!,
          link.href,
          isSpoiler,
          hasTenorGifId ? 'TENOR' : 'GIPHY',
        );
      }

      let response = await axios(url, {
        headers: {
          accept: 'image/*,text/*',
          origin: url,
          'user-agent': getUserAgent(),
        },
        method: 'GET',
        validateStatus() {
          return true;
        },
        responseType: 'arraybuffer',
        maxContentLength: 512 * 1024,
      });

      const isSuccess = response.status >= 200 && response.status < 400;
      const isUrlBlocked = this.isServerSecured(response) && !isSuccess;

      if (this.hasError(response) && !this.isForbidden(response)) {
        return;
      }

      if (isUrlBlocked && this.#concurentRequests >= 5) {
        return;
      }

      if (isUrlBlocked) {
        this.#concurentRequests += 1;

        response = await axios(scrapeApiUrl, {
          responseType: 'arraybuffer',
        });

        this.#concurentRequests -= 1;
      }

      if (this.hasError(response)) {
        return;
      }

      const isImage = this.isImage(response);
      const isHtml = this.isHtml(response);
      const isVideo = this.isVideo(response);

      if (!isImage && !isHtml && !isVideo) {
        return;
      }

      if (isVideo) {
        return this.createEmbedVideo(response, isSpoiler, isAppUrl);
      }

      if (isImage) {
        return this.createEmbedImage(response, isSpoiler, isAppUrl);
      }

      const html = Buffer.from(response.data).toString();

      const virtualConsole = new jsdom.VirtualConsole();
      virtualConsole.on('error', () => {
        // No-op to skip console errors.
      });

      const {
        window: { document },
      } = new jsdom.JSDOM(html, { virtualConsole });

      return this.createEmbedLink(document, url, link);
    } catch (e) {
      console.log(e);

      return;
    }
  }

  isForbidden(response: AxiosResponse) {
    return response.status === 403;
  }

  hasError(response: AxiosResponse) {
    return response.status >= 400 && response.status < 501;
  }

  isCloudflareServer(response: AxiosResponse) {
    const cfRay = response.headers['cf-ray'];
    const server = response.headers['server'];

    return cfRay || server === 'cloudflare';
  }

  isServerSecured(response: AxiosResponse) {
    return this.isCloudflareServer(response) || this.isForbidden(response);
  }

  filterLinks(
    links: Link[],
    embeds: Array<{ id: number; originalUrl: string | null }>,
  ) {
    const hrefs = embeds.map(({ originalUrl }) => originalUrl);

    return links.filter(({ href }) => !hrefs.includes(href));
  }

  getExistingEmbeds(hrefs: string[]) {
    return this.prisma.embed.findMany({
      where: {
        originalUrl: {
          in: hrefs,
        },
      },
      select: {
        id: true,
        originalUrl: true,
      },
    });
  }

  getContentType(response: AxiosResponse) {
    return String(response.headers['content-type'] || '');
  }

  isImage(response: AxiosResponse) {
    return this.getContentType(response).startsWith('image/');
  }

  isHtml(response: AxiosResponse) {
    return this.getContentType(response).startsWith('text/html');
  }

  isVideo(response: AxiosResponse) {
    return this.getContentType(response).startsWith('video/');
  }

  async createEmbedImage(
    response: AxiosResponse,
    isSpoiler: boolean,
    isAppUrl: boolean,
  ) {
    const [_, format] = this.getContentType(response).split(';')[0].split('/');
    const sharpInstance = sharp(response.data, { animated: true });
    const metadata = await sharpInstance.metadata();
    const fileName = randomUUID();
    const filePath = isAppUrl
      ? response.request.path!
      : `/external/${fileName}.${metadata.format}`;

    const fileUrl = new URL(filePath, this.config.get('APP_URL')!).toString();
    const fileFullPath = path.join(process.cwd(), 'public', filePath);

    if (!isAppUrl) {
      await writeFile(fileFullPath, response.data, { flag: 'w' });
    }

    const placeholder = await createPlaceholder(fileFullPath);

    const { height = 0 } = metadata;
    const { width = 0, pageHeight = height } = metadata;

    return {
      type: 'image',
      format: metadata.format || format,
      url: fileUrl,
      width,
      height: pageHeight,
      originalUrl: response.config.url!,
      isSpoiler,
      placeholder,
    } as const;
  }

  getGifData(gifData: TenorGif | GiphyGif) {
    if ('media_formats' in gifData) {
      const {
        media_formats: {
          tinymp4: {
            dims: [width, height],
            url,
          },
        },
      } = gifData;

      return { width, height, url };
    }

    const {
      images: {
        downsized_small: { mp4: url },
        original: { width, height },
      },
    } = gifData;

    return { width: Number(width), height: Number(height), url };
  }

  async createEmbedGif(
    originalUrl: string,
    isSpoiler: boolean,
    gifData: TenorGif | GiphyGif,
  ) {
    const { width, height, url } = this.getGifData(gifData);
    const placeholder = await this.getGifPlaceholder(gifData);

    return {
      type: 'gif',
      format: 'tinymp4',
      width,
      height,
      url,
      originalUrl,
      isSpoiler,
      poster: placeholder,
    } as const;
  }

  createEmbedLink(document: Document, url: string, link: Link) {
    const getProperty = (propertyName: string) => {
      const property = document.querySelector(
        `meta[property="og:${propertyName}"], meta[name="${propertyName}"], ${propertyName}`,
      );

      const value = property?.getAttribute('content') || property?.textContent;

      if (!value) {
        return '';
      }

      return value;
    };

    const title = getProperty('title');
    const siteName = getProperty('site_name');
    const image = getProperty('image');
    const description = getProperty('description');

    return {
      type: 'link',
      title,
      description,
      image,
      siteName,
      url,
      originalUrl: link.href,
    } as const;
  }

  async createEmbedVideo(
    response: AxiosResponse<Buffer>,
    isSpoiler: boolean,
    isAppUrl: boolean,
  ) {
    const [_, ext] = this.getContentType(response).split(';')[0]?.split('/');
    const format = await fileTypeFromBuffer.then((fromBuffer) =>
      fromBuffer(response.data),
    );
    const videoExtension = format?.ext || ext;
    const originalUrl = response.config.url!;
    const fileName = `${randomUUID()}.${videoExtension}`;
    const filePath = isAppUrl
      ? response.request.path!
      : path.join(UploadDestination.External, fileName);
    const fileUrl = new URL(filePath, this.config.get('APP_URL')!).toString();
    const fullPath = path.join(process.cwd(), 'public', filePath);

    if (!isAppUrl) {
      await convertVideo(fullPath, response.data);
    }

    return new Promise<EmbedMedia>(async (resolve) => {
      const poster = await createPoster(fullPath);

      ffprobe(fullPath, (_err, metadata) => {
        const width = metadata.streams[0].width || 0;
        const height = metadata.streams[0].height || 0;

        resolve({
          type: 'video',
          format: format?.ext || ext,
          url: fileUrl,
          width,
          height,
          originalUrl,
          isSpoiler,
          poster,
        });
      });
    });
  }
}
