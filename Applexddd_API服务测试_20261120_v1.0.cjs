'use strict';

const assert = require('node:assert/strict');
const { randomBytes, randomInt } = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { createApiServer, readConfig } = require('./Applexddd_API服务_20261120_v1.0.cjs');

const allowedOrigin = 'https://mingjun.example';
const accessToken = 'synthetic-test-access-token-do-not-use';
const modelKey = 'synthetic-model-key-do-not-use';
const sampleProfile = {
  name: '演示服务',
  baseUrl: 'https://models.example/v1/',
  model: 'example-model',
  apiKey: modelKey,
};

async function listen(server, t) {
  await new Promise((resolve, reject) => {
    let attempts = 0;
    const bind = () => {
      attempts++;
      // Windows can assign browser-blocked ports when listening on port 0.
      server.listen(randomInt(49152, 65536), '127.0.0.1');
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    const onError = error => {
      if (attempts < 8 && ['EADDRINUSE', 'EACCES'].includes(error.code)) {
        bind();
        return;
      }
      server.off('error', onError);
      server.off('listening', onListening);
      reject(error);
    };
    server.on('error', onError);
    server.once('listening', onListening);
    bind();
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

async function setup(t, upstreamFetch) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mingjun-api-test-'));
  t.after(async () => {
    for (const file of await fs.readdir(directory)) await fs.unlink(path.join(directory, file));
    await fs.rmdir(directory);
  });
  const config = readConfig({
    MINGJUN_ACCESS_TOKEN: accessToken,
    MINGJUN_STORAGE_KEY: randomBytes(32).toString('base64'),
    MINGJUN_UPSTREAM_HOSTS: 'models.example, other.example',
    MINGJUN_ALLOWED_ORIGINS: allowedOrigin,
    MINGJUN_DATA_FILE: path.join(directory, 'profiles.enc'),
  });

  async function start() {
    const server = await createApiServer(config, { upstreamFetch });
    const serverUrl = await listen(server, t);
    return (route, { method = 'GET', body, origin = allowedOrigin, token = accessToken, headers = {} } = {}) => fetch(serverUrl + route, {
      method,
      headers: {
        ...(origin ? { Origin: origin } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  return { start, request: await start(), config };
}

async function addProfile(request, body = sampleProfile) {
  const response = await request('/profiles', { method: 'POST', body });
  assert.equal(response.status, 201);
  return (await response.json()).profile;
}

test('requires the access token and accepts preflight from the configured origin only', async t => {
  const { request } = await setup(t);
  let response = await request('/profiles', { token: 'incorrect' });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
  assert.match((await response.json()).error, /访问口令/);

  response = await request('/profiles', { origin: 'https://unlisted.example' });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);

  response = await request('/profiles', {
    method: 'OPTIONS',
    token: '',
    headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
  assert.match(response.headers.get('access-control-allow-headers'), /authorization/i);

  response = await request('/profiles');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { profiles: [] });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('persists masked profiles through restart and keeps an omitted key on update', async t => {
  const { request, start, config } = await setup(t, async (url, options) => {
    assert.equal(String(url), 'https://models.example/chat/completions');
    assert.equal(options.headers.Authorization, `Bearer ${modelKey}`);
    return Response.json({ choices: [{ message: { content: '收到' } }] });
  });
  const created = await addProfile(request);
  assert.deepEqual(created, {
    id: created.id,
    name: '演示服务',
    baseUrl: 'https://models.example/v1',
    model: 'example-model',
    hasKey: true,
  });
  const updated = await request(`/profiles/${created.id}`, {
    method: 'PATCH',
    body: { name: '新的名称', baseUrl: 'https://models.example/chat/completions', apiKey: '' },
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).profile.model, 'example-model');

  const bytes = await fs.readFile(config.dataFile);
  assert.equal(bytes.includes(modelKey), false);
  assert.equal(bytes.includes('models.example'), false);
  const restarted = await start();
  const list = await restarted('/profiles');
  assert.deepEqual(await list.json(), {
    profiles: [{ ...created, name: '新的名称', baseUrl: 'https://models.example/chat/completions' }],
  });
  const reply = await restarted('/chat', {
    method: 'POST',
    body: { profileId: created.id, memory: '', messages: [{ role: 'user', content: '你好' }] },
  });
  assert.equal(reply.status, 200);
  assert.deepEqual(await reply.json(), { content: '收到' });
});

test('serializes concurrent configuration additions', async t => {
  const { request, start } = await setup(t);
  const profiles = await Promise.all(Array.from({ length: 5 }, (_, index) => addProfile(request, {
    ...sampleProfile, name: `配置 ${index}`,
  })));
  const restarted = await start();
  const result = await restarted('/profiles');
  const stored = (await result.json()).profiles;
  assert.deepEqual(new Set(stored.map(profile => profile.id)), new Set(profiles.map(profile => profile.id)));
});

test('refuses an incorrect storage key while preserving the encrypted file', async t => {
  const { request, config } = await setup(t);
  await addProfile(request);
  const before = await fs.readFile(config.dataFile);
  await assert.rejects(createApiServer({ ...config, storageKey: randomBytes(32) }), /无法读取 API 配置/);
  assert.deepEqual(await fs.readFile(config.dataFile), before);
});

test('validates HTTPS model gateways and requires an API key on create', async t => {
  const { request } = await setup(t);
  for (const baseUrl of [
    'http://models.example/v1',
    'https://models.example.unlisted.example/v1',
    'https://user:secret@models.example/v1',
    'https://models.example/v1?secret=value',
    'https://models.example/v1#path',
    'https://models.example:8443/v1',
  ]) {
    const response = await request('/profiles', { method: 'POST', body: { ...sampleProfile, baseUrl } });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /API 地址/);
  }
  const response = await request('/profiles', { method: 'POST', body: { ...sampleProfile, apiKey: '' } });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /API 密钥/);
});

test('requires a new key when changing API domains', async t => {
  const { request } = await setup(t);
  const profile = await addProfile(request);
  const route = `/profiles/${profile.id}`;
  const baseUrl = 'https://other.example/v1';
  const missing = await request(route, { method: 'PATCH', body: { baseUrl } });
  assert.equal(missing.status, 400);
  assert.match((await missing.json()).error, /API 密钥/);
  const updated = await request(route, {
    method: 'PATCH',
    body: { baseUrl, apiKey: 'synthetic-replacement-key' },
  });
  assert.equal(updated.status, 200);
  assert.deepEqual((await updated.json()).profile, { ...profile, baseUrl });
});

test('places current memory in one system message ahead of history, then returns model text', async t => {
  const memory = '称呼我为明军。\n请用两句话回复。';
  const history = [
    { role: 'user', content: '初次见面' },
    { role: 'assistant', content: '你好' },
    { role: 'user', content: '今天有什么安排？' },
  ];
  let observed;
  const mock = await listen(http.createServer(async (request, response) => {
    let payload = '';
    for await (const chunk of request) payload += chunk;
    observed = { requestUrl: request.url, authorization: request.headers.authorization, payload: JSON.parse(payload) };
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ choices: [{ message: { content: '明军，今天有两项安排。' } }] }));
  }), t);
  const { request } = await setup(t, (url, options) => fetch(mock + new URL(url).pathname, options));
  const profile = await addProfile(request);

  const response = await request('/chat', {
    method: 'POST',
    body: { profileId: profile.id, memory, messages: history },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { content: '明军，今天有两项安排。' });
  assert.equal(observed.requestUrl, '/v1/chat/completions');
  assert.equal(observed.authorization, `Bearer ${modelKey}`);
  assert.equal(observed.payload.model, sampleProfile.model);
  assert.equal(observed.payload.messages[0].role, 'system');
  assert.ok(observed.payload.messages[0].content.indexOf(memory) >= 0);
  assert.ok(observed.payload.messages[0].content.indexOf(memory) < observed.payload.messages[0].content.indexOf('小P'));
  assert.match(observed.payload.messages[0].content, /优先/);
  assert.deepEqual(observed.payload.messages.slice(1), history);
});

test('rejects attempts to supply custom roles and requires a final user message', async t => {
  const { request } = await setup(t, () => assert.fail('Invalid history was submitted upstream'));
  const profile = await addProfile(request);
  for (const role of ['system', 'developer', 'assistant']) {
    const response = await request('/chat', {
      method: 'POST',
      body: { profileId: profile.id, memory: '', messages: [{ role, content: '无效的对话' }] },
    });
    assert.equal(response.status, 400);
  }
});

test('disables upstream redirects and discards provider error details', async t => {
  let redirected = false;
  const mock = await listen(http.createServer((request, response) => {
    if (request.url === '/destination') redirected = true;
    response.writeHead(302, { Location: '/destination' });
    response.end(modelKey);
  }), t);
  const { request } = await setup(t, (url, options) => fetch(mock + new URL(url).pathname, options));
  const profile = await addProfile(request);
  const response = await request('/chat', {
    method: 'POST',
    body: { profileId: profile.id, memory: '', messages: [{ role: 'user', content: '你好' }] },
  });
  assert.equal(response.status, 502);
  assert.equal(redirected, false);
  const error = await response.json();
  assert.match(error.error, /模型服务/);
  assert.equal(error.error.includes(modelKey), false);
});
