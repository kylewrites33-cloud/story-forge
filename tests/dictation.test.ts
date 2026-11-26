import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addressProblem, answerText, cleanAddress, downsample, fitWords, PcmPieces, RATE, serverProblem, toPcm16, tryServer, Upload } from '../src/lib/dictation.ts';

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
  const up = new Upload({ address: 'mini.example.net', password: 'pw' }, f.fetcher, 'abc');
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
  const up = new Upload({ address: 'https://m', password: 'no' }, f.fetcher);
  up.send(new Uint8Array(4));
  await assert.rejects(up.finish(), /password/);
  assert.equal(f.calls.length, 1, 'no more pieces after a refusal');
  const gone = new Upload({ address: 'https://m', password: '' }, async () => { throw new Error('offline'); });
  gone.send(new Uint8Array(4));
  await assert.rejects(gone.finish(), /reach the speech server/);
  assert.match(serverProblem(500), /500/);
  await assert.rejects(tryServer({ address: 'http://m', password: '' }, fakeServer().fetcher, 'https:'), /https/);
  assert.match(await tryServer({ address: 'https://m', password: '' }, fakeServer().fetcher, 'https:'), /ready/);
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
