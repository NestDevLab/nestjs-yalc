import { describe, expect, it } from '@jest/globals';
import {
  ModelField,
  ModelObject,
} from '../object.decorator.js';
import { modelFieldToDest } from '../model-object/model-object.helper.js';

@ModelObject()
class InputModel {
  @ModelField({ dst: 'renamed' })
  source = 'value';

  @ModelField({
    dst: {
      name: 'transformed',
      transformerDst: (_dst, value) => `${value}-mapped`,
    },
  })
  extra = 'x';

  passthrough = 'keep';
}

class OutputModel {
  renamed!: string;
  transformed!: string;
  passthrough!: string;
}

@ModelObject()
class BrokenModel {
  @ModelField({ dst: 'missingField' })
  value = 'x';
}

describe('modelFieldToDest', () => {
  it('should return the input when it is not a class and has different keys', () => {
    const result = modelFieldToDest({ other: true }, new OutputModel());
    expect(result).toEqual({ other: true });
  });

  it('should return null when input keys match output keys', () => {
    const input = { renamed: 'x', transformed: 'y', passthrough: 'z' };
    const result = modelFieldToDest(input, input);
    expect(result).toBeNull();
  });

  it('should map decorated fields and apply transformers', () => {
    (InputModel as any).source = 'value';
    (InputModel as any).extra = 'x';
    (InputModel as any).passthrough = 'keep';

    const output = {
      renamed: '',
      transformed: '',
      passthrough: '',
    } as OutputModel;

    const mapped = modelFieldToDest(InputModel as any, output);
    expect(mapped).toEqual({
      renamed: 'value',
      transformed: 'x-mapped',
      passthrough: 'keep',
    });
  });

  it('should throw when destination does not contain the mapped property', () => {
    (BrokenModel as any).value = 'x';
    expect(() =>
      modelFieldToDest(
        BrokenModel as any,
        { renamed: '' } as unknown as OutputModel,
      ),
    ).toThrow(
      "Cannot map property missingField into the OutputObject. Property doesn't exist in the destination",
    );
  });
});
