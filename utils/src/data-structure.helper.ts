export const arrayGroupByField = <T, K extends string | number | symbol>(
  entityArray: T[],
  getKey: (item: T) => K,
): Record<K, T[]> => {
  return entityArray.reduce(
    (acc, current) => {
      const property = getKey(current);
      acc[property] ??= [];
      acc[property].push(current);
      return acc;
    },
    {} as Record<K, T[]>,
  );
};
