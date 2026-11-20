'use strict';

const {
  createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual,
} = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');

const pagesOrigin = 'https://17377304124m-cpu.github.io';
const bodyLimit = 512 * 1024;
const responseLimit = 2 * 1024 * 1024;
const messageLimit = 32_768;
const methods = ['GET', 'POST', 'PATCH'];

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readConfig(env = process.env) {
  const accessToken = env.MINGJUN_ACCESS_TOKEN?.trim();
  if (!accessToken || !/^[\x21-\x7e]{32,512}$/.test(accessToken)) {
    throw new ApiError(500, '请将 MINGJUN_ACCESS_TOKEN 设置为至少 32 字符的随机访问口令。');
  }

  const encodedKey = env.MINGJUN_STORAGE_KEY?.trim();
  if (!encodedKey || !/^[A-Za-z0-9+/]{43}=$/.test(encodedKey)) {
    throw new ApiError(500, '请将 MINGJUN_STORAGE_KEY 设置为 32 字节随机值的 Base64 编码。');
  }
  const storageKey = Buffer.from(encodedKey, 'base64');

  const upstreamHosts = new Set((env.MINGJUN_UPSTREAM_HOSTS || '').split(',').map(host => host.trim().toLowerCase()).filter(Boolean));
  const domainPattern = /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z](?:[a-z\d-]{0,61}[a-z\d])?$/;
  if (!upstreamHosts.size || [...upstreamHosts].some(host => !domainPattern.test(host))) {
    throw new ApiError(500, '请在 MINGJUN_UPSTREAM_HOSTS 中填写以逗号分隔的模型服务域名。');
  }

  const allowedOrigins = new Set((env.MINGJUN_ALLOWED_ORIGINS ?? pagesOrigin).split(',').map(origin => origin.trim()).filter(Boolean));
  for (const origin of allowedOrigins) {
    try {
      const url = new URL(origin);
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (origin === url.origin && (url.protocol === 'https:' || (url.protocol === 'http:' && loopback))) continue;
    } catch {
      // Invalid origins use the same configuration error.
    }
    throw new ApiError(500, '请在 MINGJUN_ALLOWED_ORIGINS 中填写完整的网站源，本机联调可使用 HTTP。');
  }

  const filename = env.MINGJUN_DATA_FILE?.trim();
  if (!filename || !path.isAbsolute(filename)) {
    throw new ApiError(500, '请将 MINGJUN_DATA_FILE 设置为项目目录外的数据文件绝对路径。');
  }
  const dataFile = path.resolve(filename);
  const relative = path.relative(__dirname, dataFile);
  if (!relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep))) {
    throw new ApiError(500, '请将 MINGJUN_DATA_FILE 设置为项目目录外的数据文件绝对路径。');
  }

  const port = Number(env.MINGJUN_PORT ?? env.PORT ?? '8787');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new ApiError(500, '请将 MINGJUN_PORT 设置为有效的端口号。');
  }
  const host = env.MINGJUN_HOST?.trim() || '127.0.0.1';

  return { accessToken, storageKey, upstreamHosts, allowedOrigins, dataFile, host, port };
}

async function readProfiles(dataFile, storageKey) {
  try {
    const encrypted = await fs.readFile(dataFile);
    // The file contains a 12-byte nonce, a 16-byte tag, then ciphertext.
    const decipher = createDecipheriv('aes-256-gcm', storageKey, encrypted.subarray(0, 12));
    decipher.setAuthTag(encrypted.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new ApiError(500, '无法读取 API 配置，请检查存储密钥和数据文件。');
  }
}

async function writeProfiles(profiles, dataFile, storageKey) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', storageKey, nonce);
  const encoded = Buffer.concat([cipher.update(JSON.stringify(profiles)), cipher.final()]);
  const temporaryFile = `${dataFile}.${randomUUID()}.tmp`;

  try {
    await fs.mkdir(path.dirname(dataFile), { recursive: true, mode: 0o700 });
    await fs.writeFile(temporaryFile, Buffer.concat([nonce, cipher.getAuthTag(), encoded]), {
      flag: 'wx', mode: 0o600, flush: true,
    });
    await fs.rename(temporaryFile, dataFile);
  } catch {
    await fs.rm(temporaryFile, { force: true }).catch(() => {});
    throw new ApiError(500, '无法保存 API 配置，请检查数据文件权限。');
  }
}

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

async function readBody(request) {
  if (request.headers['content-type']?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    throw new ApiError(415, '请求内容必须使用 JSON 格式。');
  }
  const tooLarge = new ApiError(413, '提交内容太长，请缩短记忆或对话后再试。');
  if (Number(request.headers['content-length']) > bodyLimit) throw tooLarge;

  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > bodyLimit) throw tooLarge;
    chunks.push(chunk);
  }

  try {
    const data = JSON.parse(Buffer.concat(chunks));
    if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  } catch {
    // Only JSON objects are accepted by the API routes.
  }
  throw new ApiError(400, '请求中的 JSON 格式有误。');
}

function modelAddress(value, upstreamHosts) {
  let url;
  try {
    if (typeof value === 'string' && value.length <= 2048) url = new URL(value.trim());
  } catch {
    // The validation below supplies a consistent error.
  }
  if (!url || url.protocol !== 'https:' || url.port || url.username || url.password || url.href.includes('?') ||
      url.href.includes('#') || !upstreamHosts.has(url.hostname)) {
    throw new ApiError(400, 'API 地址必须是已允许域名的 HTTPS 地址，不得包含用户名、密码、查询或片段。');
  }
  const pathname = url.pathname.replace(/\/+$/, '');
  return { baseUrl: url.origin + pathname, endpoint: url.origin + (pathname.endsWith('/chat/completions') ? pathname : pathname + '/chat/completions') };
}

function publicProfile({ id, name, baseUrl, model, apiKey }) {
  return { id, name, baseUrl, model, hasKey: Boolean(apiKey) };
}

function profileInput(body, existing, upstreamHosts) {
  const rawName = body.name === undefined ? existing?.name : body.name;
  const rawModel = body.model === undefined ? existing?.model : body.model;
  const name = typeof rawName === 'string' ? rawName.trim() : '';
  const model = typeof rawModel === 'string' ? rawModel.trim() : '';
  if (!name || name.length > 100) throw new ApiError(400, '请填写 100 字以内的配置名称。');
  if (!model || model.length > 200) throw new ApiError(400, '请填写 200 字以内的模型名称。');

  const suppliedAddress = body.baseUrl === undefined ? existing?.baseUrl : body.baseUrl;
  const { baseUrl } = modelAddress(suppliedAddress, upstreamHosts);
  if (body.apiKey !== undefined && typeof body.apiKey !== 'string') {
    throw new ApiError(400, '请输入有效的 API 密钥。');
  }
  const suppliedKey = body.apiKey?.trim();
  if (!suppliedKey && existing && new URL(baseUrl).origin !== new URL(existing.baseUrl).origin) {
    throw new ApiError(400, '修改 API 域名时，请输入新服务的 API 密钥。');
  }
  const apiKey = suppliedKey || existing?.apiKey;
  if (!apiKey || !/^[\x21-\x7e]{1,4096}$/.test(apiKey)) {
    throw new ApiError(400, '请输入有效的 API 密钥。');
  }
  return { id: existing?.id ?? randomUUID(), name, baseUrl, model, apiKey };
}

async function requestModel(profile, body, config, upstreamFetch) {
  const memory = body.memory ?? '';
  if (typeof memory !== 'string' || memory.length > messageLimit) {
    throw new ApiError(400, '记忆最多可包含 32768 个字符。');
  }
  const { messages } = body;
  if (!Array.isArray(messages) || messages.length > 80 || messages.at(-1)?.role !== 'user' ||
      messages.some(message => !message || !['user', 'assistant'].includes(message.role) ||
        typeof message.content !== 'string' || !message.content.trim() || message.content.length > messageLimit)) {
    throw new ApiError(400, '对话最多可包含 80 条有效消息，每条不超过 32768 个字符，最后一条须为用户消息。');
  }

  const assistantRole = '默认身份：你是小P，明军的个人助手。';
  const systemPrompt = memory.trim()
    ? `以下是用户保存的记忆和指令，在本应用内优先于默认身份及后续对话。\n\n${memory}\n\n${assistantRole}`
    : assistantRole;
  const { endpoint } = modelAddress(profile.baseUrl, config.upstreamHosts);

  try {
    const response = await upstreamFetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${profile.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: profile.model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages.map(({ role, content }) => ({ role, content }))],
        stream: false,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(90_000),
    });

    if (!response.ok || !response.body) {
      await response.body?.cancel();
      if (response.status === 429) throw new ApiError(429, '模型服务请求过多，请稍后重试。');
      if (response.status === 401 || response.status === 403) {
        throw new ApiError(502, '模型服务未授权，请检查模型 API 密钥和权限。');
      }
      throw new ApiError(502, '模型服务暂未返回有效回复，请检查 API 配置后重试。');
    }

    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > responseLimit) throw new ApiError(502, '模型服务返回的内容过长。');
      chunks.push(chunk);
    }
    const result = JSON.parse(Buffer.concat(chunks));
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new ApiError(502, '模型服务未返回可显示的文本。');
    }
    return content;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new ApiError(504, '模型服务响应超时，请稍后再试。');
    }
    throw new ApiError(502, '暂时无法连接模型服务，请检查 API 地址后重试。');
  }
}

async function createApiServer(config, { upstreamFetch = fetch } = {}) {
  let profiles = await readProfiles(config.dataFile, config.storageKey);
  let pendingWrite = Promise.resolve();
  const expectedToken = createHash('sha256').update(config.accessToken).digest();

  function saveProfile(body, id) {
    const operation = pendingWrite.then(async () => {
      const existing = profiles.find(profile => profile.id === id);
      if (id && !existing) throw new ApiError(404, '找不到该 API 配置。');
      const updated = profileInput(body, existing, config.upstreamHosts);
      const next = existing ? profiles.map(profile => profile.id === id ? updated : profile) : [...profiles, updated];
      await writeProfiles(next, config.dataFile, config.storageKey);
      profiles = next;
      return publicProfile(updated);
    });
    pendingWrite = operation.catch(() => {});
    return operation;
  }

  return http.createServer({ requestTimeout: 45_000 }, async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Vary', 'Origin');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    try {
      const origin = request.headers.origin;
      if (origin) {
        if (!config.allowedOrigins.has(origin)) throw new ApiError(403, '此网站未获准访问 API 服务。');
        response.setHeader('Access-Control-Allow-Origin', origin);
      }

      if (request.method === 'OPTIONS') {
        if (!origin || !methods.includes(request.headers['access-control-request-method'])) {
          throw new ApiError(403, '此预检请求未获准。');
        }
        response.writeHead(204, {
          'Access-Control-Allow-Methods': methods.join(', '),
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        });
        response.end();
        return;
      }

      const token = /^Bearer (\S+)$/i.exec(request.headers.authorization || '')?.[1];
      if (!token || !timingSafeEqual(createHash('sha256').update(token).digest(), expectedToken)) {
        throw new ApiError(401, '访问口令有误，请重新连接 API 服务。');
      }

      const { pathname } = new URL(request.url, 'http://localhost');
      if (pathname === '/profiles' && request.method === 'GET') {
        sendJson(response, 200, { profiles: profiles.map(publicProfile) });
        return;
      }
      if (pathname === '/profiles' && request.method === 'POST') {
        sendJson(response, 201, { profile: await saveProfile(await readBody(request)) });
        return;
      }
      const id = /^\/profiles\/([0-9a-f-]+)$/.exec(pathname)?.[1];
      if (id && request.method === 'PATCH') {
        sendJson(response, 200, { profile: await saveProfile(await readBody(request), id) });
        return;
      }
      if (pathname === '/chat' && request.method === 'POST') {
        const body = await readBody(request);
        const profile = profiles.find(item => item.id === body.profileId);
        if (!profile) throw new ApiError(404, '找不到该 API 配置，请在配置页重新选择。');
        sendJson(response, 200, { content: await requestModel(profile, body, config, upstreamFetch) });
        return;
      }
      throw new ApiError(404, '找不到该 API 路径。');
    } catch (error) {
      if (response.destroyed) return;
      if (error instanceof ApiError) {
        if (error.status === 413) response.setHeader('Connection', 'close');
        sendJson(response, error.status, { error: error.message });
      } else {
        sendJson(response, 500, { error: 'API 服务暂时无法处理请求。' });
      }
    }
  });
}

if (require.main === module) {
  (async () => {
    const config = readConfig();
    const server = await createApiServer(config);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, config.host, resolve);
    });
    console.log(`明军 API 服务正在监听端口 ${config.port}。`);
  })().catch(error => {
    console.error(error instanceof ApiError ? error.message : '无法启动 API 服务，请检查端口和监听地址。');
    process.exitCode = 1;
  });
}

module.exports = { createApiServer, readConfig };
