import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import process from 'node:process';

const cwd = process.cwd();
const env = await loadEnvFile();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY || '';
const PORT = process.env.PORT || 3000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function parseEnv(raw) {
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const [key, ...rest] = line.split('=');
      acc[key] = rest.join('=').trim();
      return acc;
    }, {});
}

async function loadEnvFile() {
  try {
    const data = await readFile(join(cwd, '.env'), 'utf8');
    return parseEnv(data);
  } catch {
    return {};
  }
}

async function getRequestBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  return body.length ? JSON.parse(body) : {};
}

async function handleOpenAIRequest(payload) {
  if (!OPENAI_API_KEY) {
    return { status: 500, body: { error: 'OpenAI API key not configured in .env' } };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: payload.model || 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: payload.systemPrompt },
        { role: 'user', content: payload.userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { status: response.status, body: { error: data.error?.message || JSON.stringify(data) } };
  }
  return { status: 200, body: { data } };
}

function respond(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

async function serveStatic(req, res, pathname) {
  const filePath = pathname === '/' ? '/index.html' : pathname;
  const safePath = filePath.includes('..') ? null : join(cwd, filePath);
  if (!safePath) {
    res.writeHead(400);
    return res.end('Bad request');
  }

  try {
    const data = await readFile(safePath);
    const type = mimeTypes[extname(safePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/status') {
    return respond(res, 200, { ready: Boolean(OPENAI_API_KEY) });
  }

  if (url.pathname === '/api/generate' && req.method === 'POST') {
    try {
      const payload = await getRequestBody(req);
      const result = await handleOpenAIRequest(payload);
      return respond(res, result.status, result.body);
    } catch (err) {
      return respond(res, 500, { error: err.message || 'Unknown error' });
    }
  }

  await serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`OpenAI key loaded: ${Boolean(OPENAI_API_KEY)}`);
});
