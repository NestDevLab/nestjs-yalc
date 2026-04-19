import { JsonTransformer } from '../transformers.helpers.js';
import {
  isYalcTransformerGuard,
  yalcNew,
  yalcPlainToInstance,
} from '../transformers.helpers.js';

describe('Test transformers', () => {
  it('should provide and execute a json transformer', () => {
    const dstObj = { jsonData: {} };
    JsonTransformer('jsonData', 'property')(dstObj, '1');
    expect(dstObj).toStrictEqual({ jsonData: { property: '1' } });
  });

  it('should provide and execute a json transformer with missing subproperty', () => {
    const dstObj = {};
    JsonTransformer('jsonData', 'sub.property')(dstObj, '1');
    expect(dstObj).toStrictEqual({
      jsonData: { sub: { property: '1' } },
    });
  });

  it('should detect transformer guards and invoke hooks', () => {
    class WithHook {
      public originalInput?: any;
      onAfterTransform?(src: any): void {
        this.originalInput = src;
      }
    }

    const instance = yalcPlainToInstance(WithHook, { foo: 'bar' });
    expect(isYalcTransformerGuard(instance)).toBe(true);
    expect(
      Object.prototype.hasOwnProperty.call(instance, 'onAfterTransform'),
    ).toBe(false);
    expect((instance as any).originalInput).toEqual({ foo: 'bar' });
  });

  it('yalcNew should reuse yalcPlainToInstance', () => {
    class Basic {
      value?: string;
    }

    const instance = yalcNew(Basic, { value: 'ok' });
    expect(instance).toBeInstanceOf(Basic);
    expect(instance.value).toBe('ok');
  });

  it('yalcPlainToInstance should ignore non-object plain values', () => {
    class Basic {
      value?: string;
    }

    const instance = yalcPlainToInstance(Basic, 'not-an-object' as any);
    expect(instance).toBeInstanceOf(Basic);
    expect(instance.value).toBeUndefined();
  });
});
