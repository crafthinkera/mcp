import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { parseConfig } from '../dist/config.js';

test('rejects remote HTTP and credentials in URLs', () => {
  for (const url of ['http://example.com/mcp', 'https://user:secret@example.com/mcp', 'https://example.com/mcp?token=secret', 'https://example.com/mcp#secret']) {
    assert.throws(() => parseConfig({url, token: 'test'}));
  }
  assert.equal(parseConfig({token:' ctk_test '}).token, 'ctk_test');
});

test('real stdio client initializes over HTTP, aggregates lists and forwards explicit pagination and tool errors', {timeout: 15000}, async () => {
  const requests = [];
  const server = createServer(async (req, res) => {
    assert.equal(req.headers.authorization, 'Bearer ctk_fixture-token');
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    let raw = ''; for await (const chunk of req) raw += chunk;
    const message = JSON.parse(raw); requests.push(message);
    if (!('id' in message)) { res.writeHead(202).end(); return; }
    let result;
    if (message.method === 'initialize') result = { protocolVersion: message.params.protocolVersion, capabilities: {tools:{}}, serverInfo:{name:'fixture',version:'1'} };
    else if (message.method === 'tools/list') result = message.params?.cursor === 'page2'
      ? {tools: [{name:'second', inputSchema:{type:'object'}}]}
      : {tools: [{name:'first', inputSchema:{type:'object'}}], nextCursor:'page2'};
    else if (message.method === 'tools/call') result = {content:[{type:'text',text:JSON.stringify(message.params.arguments)}], isError:true};
    else { res.writeHead(400).end(); return; }
    res.writeHead(200, {'content-type':'application/json'}).end(JSON.stringify({jsonrpc:'2.0',id:message.id,result}));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const client = new Client({name:'test',version:'1'});
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../dist/cli.js', import.meta.url)), '--remote', '--url', `http://127.0.0.1:${server.address().port}/mcp`],
    env: {...process.env, CRAFTHINKERA_MCP_TOKEN:'ctk_fixture-token'},
    stderr:'pipe',
  });
  let stderr = ''; transport.stderr?.on('data', chunk => stderr += chunk);
  try {
    await client.connect(transport);
    const all = await client.listTools();
    assert.deepEqual(all.tools.map(tool => tool.name), ['first', 'second']);
    const first = await client.listTools({cursor:'page1'});
    assert.equal(first.nextCursor, 'page2');
    assert.equal((await client.listTools({cursor:first.nextCursor})).tools[0].name, 'second');
    const result = await client.callTool({name:'first',arguments:{intent:'make a fixture'}});
    assert.equal(result.isError, true);
    assert.deepEqual(JSON.parse(result.content[0].text), {intent:'make a fixture'});
    assert.ok(requests.some(r => r.method === 'initialize'));
    assert.ok(!stderr.includes('fixture-token'));
  } finally {
    await client.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
