import { URL, URLSearchParams } from 'url';

export function buildUrl(
  pathname: string,
  base: string,
  query: Record<string, string | string[]> = {},
) {
  const { pathname: basePathname, origin } = new URL(base);
  const searchParams = new URLSearchParams(query);

  let url = new URL(`${basePathname}${pathname}`, origin);

  if (basePathname === '/') {
    url = new URL(pathname, origin);
  }

  url.search = searchParams.toString();

  return url;
}
