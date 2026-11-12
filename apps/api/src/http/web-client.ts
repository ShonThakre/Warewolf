import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

/** Paths the server owns. The client fallback never answers them. */
const SERVER_PATHS = /^\/(api|socket\.io)(\/|$)/;

/**
 * Serves the built web client from the API process (HOST-01), so one host
 * serves the pages, `/api`, and Socket.IO on a single origin.
 *
 * Vite fingerprints everything under `assets/`, so those files are cached for
 * a year. Any other GET without a file extension is a client route and gets
 * `index.html`, uncached, so a new deploy reaches the next page load. A
 * missing file with an extension falls through to the API's JSON 404.
 */
export function serveWebClient(app: NestExpressApplication, dir: string): void {
  const root = resolve(dir);
  const index = join(root, 'index.html');
  if (!existsSync(index)) throw new Error(`WEB_DIST_DIR has no index.html: ${root}`);

  app.useStaticAssets(join(root, 'assets'), { prefix: '/assets/', immutable: true, maxAge: '1y' });
  app.useStaticAssets(root, { index: false });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || SERVER_PATHS.test(req.path) || extname(req.path) !== '') {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
}
