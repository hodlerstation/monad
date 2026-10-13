'use strict';
// Native-free replacement for the four bigint-buffer calls used by buffer-layout-utils.
// No native addon, unsafe allocation, or silent integer truncation.
const { Buffer } = require('buffer');
function decode(input, little) {
  if (!Buffer.isBuffer(input)) throw new TypeError('Expected Buffer');
  const bytes = little ? Buffer.from(input).reverse() : input;
  const hex = bytes.toString('hex');
  return hex ? BigInt('0x' + hex) : 0n;
}
function encode(value, width, little) {
  if (typeof value !== 'bigint') throw new TypeError('Expected bigint');
  if (!Number.isSafeInteger(width) || width < 0 || width > 1048576) throw new RangeError('Invalid buffer width');
  if (value < 0n || value.toString(2).length > width * 8 && value !== 0n) throw new RangeError('Integer does not fit unsigned width');
  if (width === 0) return Buffer.alloc(0);
  const bytes = Buffer.from(value.toString(16).padStart(width * 2, '0'), 'hex');
  return little ? bytes.reverse() : bytes;
}
exports.toBigIntLE = input => decode(input, true);
exports.toBigIntBE = input => decode(input, false);
exports.toBufferLE = (value, width) => encode(value, width, true);
exports.toBufferBE = (value, width) => encode(value, width, false);
