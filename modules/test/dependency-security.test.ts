import { test, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const safe = require('../compat/bigint-buffer/index.cjs');

test.each([0, 1, 8, 16, 24, 32, 64, 1024])('native-free unsigned round trips at width %i', width => {
  for (const value of [0n, width ? 1n : 0n, (1n << BigInt(width * 8)) - 1n]) {
    const le = safe.toBufferLE(value, width);
    const be = safe.toBufferBE(value, width);
    expect(le).toHaveLength(width);
    expect(safe.toBigIntLE(le)).toBe(value);
    expect(safe.toBigIntBE(be)).toBe(value);
    expect(Buffer.from(le).reverse()).toEqual(be);
  }
});
test('known byte order and immutable input', () => {
  const bytes = Buffer.from([0x01, 0x02, 0xff]);
  expect(safe.toBigIntLE(bytes)).toBe(0xff0201n);
  expect(safe.toBigIntBE(bytes)).toBe(0x0102ffn);
  expect(bytes).toEqual(Buffer.from([1, 2, 255]));
});
test('rejects overflow, negative values and invalid widths without truncating', () => {
  for (const encode of [safe.toBufferLE, safe.toBufferBE]) {
    expect(() => encode(256n, 1)).toThrow(RangeError);
    expect(() => encode(-1n, 8)).toThrow(RangeError);
    expect(() => encode(1n, 0)).toThrow(RangeError);
    for (const width of [-1, 0.5, NaN, Infinity, 1048577]) expect(() => encode(0n, width)).toThrow(RangeError);
    expect(() => encode(1, 8)).toThrow(TypeError);
  }
});
test('installed Solana dependency resolves the safe replacement and preserves u64/u256 layout', () => {
  const owner = createRequire(require.resolve('@solana/buffer-layout-utils'));
  expect(owner('bigint-buffer').toBufferLE).toBe(safe.toBufferLE);
  const layout = owner('@solana/buffer-layout-utils');
  for (const [make, bytes] of [[layout.u64, 8], [layout.u128, 16], [layout.u256, 32]] as const) {
    const codec = make(); const value = (1n << BigInt(bytes * 8)) - 1n;
    const buffer = Buffer.alloc(bytes + 4, 0x55);
    codec.encode(value, buffer, 2);
    expect(codec.decode(buffer, 2)).toBe(value);
    expect(buffer[0]).toBe(0x55); expect(buffer[bytes + 3]).toBe(0x55);
    expect(() => codec.encode(value + 1n, buffer, 2)).toThrow(RangeError);
  }
});
test('overridden JSON-RPC client works with Solana RPC connection', async () => {
  const { Connection } = require('@solana/web3.js');
  const connection = new Connection('http://localhost:8899', { fetch: async (_url: unknown, init: {body: string}) => {
    const request = JSON.parse(init.body);
    return new Response(JSON.stringify({jsonrpc:'2.0', id:request.id, result:1234}), {headers:{'content-type':'application/json'}});
  }});
  expect(await connection.getBlockHeight()).toBe(1234);
});
test('patched UUID and Sharp preserve basic caller APIs', async () => {
  const { v4, validate } = require('uuid'); expect(validate(v4())).toBe(true);
  const sharp = require('sharp');
  const image = await sharp({create:{width:2,height:2,channels:3,background:'purple'}}).png().toBuffer();
  expect((await sharp(image).metadata()).width).toBe(2);
});
