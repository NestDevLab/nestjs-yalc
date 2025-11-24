import { describe, expect, it } from '@jest/globals';
import { inflate, deflate } from '../zlib.helper.js';

describe('zlib helpers', () => {
  it('should return input when inflate/deflate fail', () => {
    const plain = 'not-base64';
    expect(inflate(plain)).toBe(plain);

    const invalidInput: any = { invalid: true };
    expect(deflate(invalidInput)).toBe(invalidInput);
  });

  it('should deflate and inflate valid payloads', () => {
    const payload = 'hello';
    const deflated = deflate(payload) as Buffer;
    expect(deflated).toBeInstanceOf(Buffer);
    const inflated = inflate(deflated.toString('base64'));
    expect(inflated).toBe(payload);
  });
});
