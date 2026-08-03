import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT) || 8000;
const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

export const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(request.url.split('?')[0]);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^[/\\]+/, '');
    const file = normalize(join(root, relative));
    if (!file.startsWith(root)) throw new Error('Forbidden');
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    response.end(data);
  } catch {
    if (!response.headersSent) response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
  }
}).listen(port, () => console.log(`CSV Viewer: http://localhost:${port}`));
