import { ClassType } from '@nestjs-yalc/types/globals.d.js';
import { deepMerge, objectSetProp } from '@nestjs-yalc/utils/object.helper.js';
import { plainToInstance } from 'class-transformer';

export function JsonTransformer(field: string, propertyPath: string) {
  return (dstObj: Record<any, any>, srcValue: any): any => {
    const patch = objectSetProp({}, propertyPath, srcValue);
    const merged = deepMerge(dstObj[field] ?? {}, patch);
    dstObj[field] = merged;
    return merged;
  };
}

export interface IYalcTransformer<TSrc> {
  onAfterTransform?: { (srcObj: TSrc | any): void };
}

export function isYalcTransformerGuard<TSrc>(
  obj: any,
): obj is IYalcTransformer<TSrc> {
  return obj?.onAfterTransform !== undefined;
}

/**
 * Extended version of the plainToInstance
 * It support the IYalcTransformer interface to be able to
 * hook into the transformation process and trigger extra events for more complex
 * transformations. It also avoid unwanted behaviours when the plain value is not
 * an object.
 */
export function yalcPlainToInstance<TDest, TSrc = TDest>(
  cls: ClassType<TDest | IYalcTransformer<TSrc>>,
  plain: TSrc,
): TDest {
  const instance = plainToInstance(cls, typeof plain === 'object' ? plain : {});
  if (isYalcTransformerGuard<TSrc>(instance)) {
    instance.onAfterTransform?.(plain);
    delete instance.onAfterTransform;
  }

  return instance as TDest;
}

/**
 * Just a shortcut for the yalcPlainToInstance
 * with cls and plain as the same type
 * This method is useful when you want to instantiate any class
 * without specifying the constructor, and still be able to use the
 * transformer hooks
 */
export function yalcNew<T>(
  cls: ClassType<T | IYalcTransformer<T>>,
  plain: T,
): T {
  return yalcPlainToInstance(cls, plain);
}
