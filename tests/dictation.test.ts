import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addresses, missingSeqs, setupProblem, addressProblem, answerText, cleanAddress, downsample, fitWords, PcmPieces, RATE, serverProblem, toPcm16, tryServer, Upload } from '../src/lib/dictation.ts';

test('the address is tidied and an http address is caught on an https page', () => {
  assert.equal(cleanAddress(' mini.example.net/ '), 'https://mini.example.net');
  assert.equal(cleanAddress('http://192.168.1.166:8178'), 'http://192.168.1.166:8178');
  assert.equal(cleanAddress(''), '');
  assert.match(addressProblem('', 'https:') || '', /Settings/);
  assert.match(addressProblem('http://192.168.1.166:8178', 'https:') || '', /https:\/\//);
  assert.equal(addressProblem('http://localhost:8178', 'http:'), null);
  assert.equal(addressProblem('https://mini.example.net', 'https:'), null);
});

test('sound becomes 16-bit little-endian PCM at 16,000 a second', () => {
  const pcm = toPcm16(new Float32Array([0, 1, -1, 2]));
  const v = new DataView(pcm.buffer);
  assert.deepEqual([v.getInt16(0, true), v.getInt16(2, true), v.getInt16(4, true), v.getInt16(6, true)], [0, 32767, -32768, 32767]);
  assert.equal(downsample(new Float32Array(48000), 48000).length, 16000);
  assert.equal(downsample(new Float32Array(44100), 44100).length, 16000);
  // Pieces of one second each, the rest at the end, nothing lost across odd-sized pushes.
  const p = new PcmPieces(48000);
  let bytes = 0, pieces = 0;
  for (let i = 0; i < 40; i++) for (const x of p.push(new Float32Array(4096))) { bytes += x.length; pieces++; }
  bytes += p.rest().length;
  assert.equal(pieces, 3);
  assert.ok(Math.abs(bytes / 2 - Math.floor(40 * 4096 / 3)) <= 1, 'every sample comes out once: ' + bytes / 2);
  assert.equal(RATE, 16000);
});

function fakeServer(opts: { fail?: number; text?: string } = {}) {
  const calls: { method: string; url: string; auth?: string; size: number }[] = [];
  const fetcher = async (url: string, init: { method: string; headers: Record<string, string>; body?: Uint8Array }) => {
    calls.push({ method: init.method, url, auth: init.headers.Authorization, size: init.body ? init.body.length : 0 });
    if (opts.fail) return { ok: false, status: opts.fail, text: async () => '' };
    return { ok: true, status: 200, text: async () => (init.method === 'POST' ? opts.text ?? '{"text":" hello there "}' : '') };
  };
  return { calls, fetcher };
}

test('pieces go up in order with the password, then finish counts them', async () => {
  const f = fakeServer();
  const up = new Upload({ address: 'mini.example.net', password: 'pw', away: '' }, f.fetcher, 'abc');
  up.send(new Uint8Array(10)); up.send(new Uint8Array(0)); up.send(new Uint8Array(6));
  assert.equal(await up.finish(), 'hello there');
  assert.deepEqual(f.calls.map((c) => c.method + ' ' + c.url), [
    'PUT https://mini.example.net/v1/dictation/abc/chunk/0',
    'PUT https://mini.example.net/v1/dictation/abc/chunk/1',
    'POST https://mini.example.net/v1/dictation/abc/finish?chunks=2&bytes=16'
  ]);
  assert.ok(f.calls.every((c) => c.auth === 'Bearer pw'));
});

test('a refused password and an unreachable server say so plainly', async () => {
  const f = fakeServer({ fail: 401 });
  const up = new Upload({ address: 'https://m', password: 'no', away: '' }, f.fetcher);
  up.send(new Uint8Array(4));
  await assert.rejects(up.finish(), /dictation key/);
  assert.equal(f.calls.length, 1, 'no more pieces after a refusal');
  const gone = new Upload({ address: 'https://m', password: 'k', away: '' }, async () => { throw new Error('offline'); });
  gone.send(new Uint8Array(4));
  await assert.rejects(gone.finish(), /reach the speech server/);
  assert.match(serverProblem(500), /500/);
  await assert.rejects(tryServer({ address: 'http://m', password: 'k', away: '' }, fakeServer().fetcher, 'https:'), /https/);
  assert.match(await tryServer({ address: 'https://m', password: 'k', away: '' }, fakeServer().fetcher, 'https:'), /ready/);
});

test('the answer can be JSON or plain text', () => {
  assert.equal(answerText('{"text":"Hi."}'), 'Hi.');
  assert.equal(answerText('  Hi there.\n'), 'Hi there.');
  assert.equal(answerText('{"transcript":"Yo"}'), 'Yo');
});

test('dictated words fit the words around the cursor', () => {
  assert.equal(fitWords('', 'the sky was green.', ''), 'The sky was green.');
  assert.equal(fitWords('He ran.', 'she stayed.', ''), ' She stayed.');
  assert.equal(fitWords('He ran ', 'fast', 'and far'), 'fast ');
  assert.equal(fitWords('He ran', 'fast', ''), ' fast');
  assert.equal(fitWords('Basil said, "', 'no thanks', '"'), 'No thanks'.replace('N', 'n'));
  assert.equal(fitWords('He said (', 'quietly', ')'), 'quietly');
  assert.equal(fitWords('One.\n\n', 'two', ''), 'Two');
  assert.equal(fitWords('A *quiet*', 'night', ''), ' night');
  assert.equal(fitWords('x', '   ', 'y'), '');
});

test('home first with a quick give-up, then away, and the next pieces stay there', async () => {
  const s = { address: 'https://home', away: 'https://away', password: 'k' };
  assert.deepEqual(addresses(s).map((a) => a.place), ['home', 'away']);
  assert.deepEqual(addresses(s, 'away').map((a) => a.place), ['away', 'home']);
  assert.deepEqual(addresses({ ...s, away: '' }).map((a) => a.place), ['home']);
  const calls: string[] = [];
  // Home never answers (away from home): the fetch waits until it is given up on.
  const fetcher = (url: string, init: { method: string; signal?: AbortSignal }) => {
    calls.push(init.method + ' ' + url);
    if (url.startsWith('https://home')) return new Promise<never>((_, no) => { init.signal?.addEventListener('abort', () => no(new Error('aborted'))); });
    return Promise.resolve({ ok: true, status: 200, text: async () => (init.method === 'POST' ? '{"text":"away words"}' : '') });
  };
  const up = new Upload(s, fetcher as never, 'id1', addresses(s), 30);
  up.send(new Uint8Array(4)); up.send(new Uint8Array(4));
  assert.equal(await up.finish(), 'away words');
  assert.equal(up.place(), 'away');
  assert.deepEqual(calls, ['PUT https://home/v1/dictation/id1/chunk/0', 'PUT https://away/v1/dictation/id1/chunk/0', 'PUT https://away/v1/dictation/id1/chunk/1', 'POST https://away/v1/dictation/id1/finish?chunks=2&bytes=8']);
  // A refused key is not a reason to try the other address.
  const refused: string[] = [];
  const up2 = new Upload(s, (async (url: string) => { refused.push(url); return { ok: false, status: 401, text: async () => '' }; }) as never, 'id2', addresses(s));
  up2.send(new Uint8Array(4));
  await assert.rejects(up2.finish(), /key/);
  assert.equal(refused.length, 1);
  assert.match(setupProblem({ ...s, password: '' }, 'https:') || '', /key/);
  assert.equal(setupProblem(s, 'https:'), null);
});

test('pieces the server missed go again, then finish again', async () => {
  const calls: string[] = [];
  let finishes = 0;
  const fetcher = async (url: string, init: { method: string }) => {
    calls.push(init.method + ' ' + url.replace(/^.*\/id3/, ''));
    if (init.method === 'POST' && finishes++ === 0) return { ok: false, status: 409, text: async () => '{"missing":[1]}' };
    return { ok: true, status: 200, text: async () => (init.method === 'POST' ? '{"text":"all here","transcribe_seconds":0.4}' : '') };
  };
  const up = new Upload({ address: 'https://m', away: '', password: 'k' }, fetcher as never, 'id3');
  up.send(new Uint8Array(2)); up.send(new Uint8Array(2));
  assert.equal(await up.finish(), 'all here');
  assert.deepEqual(calls, ['PUT /chunk/0', 'PUT /chunk/1', 'POST /finish?chunks=2&bytes=4', 'PUT /chunk/1', 'POST /finish?chunks=2&bytes=4']);
  assert.deepEqual(missingSeqs('{"missing":[0,2,"x",-1]}'), [0, 2]);
});
