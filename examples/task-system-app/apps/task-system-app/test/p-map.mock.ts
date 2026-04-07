export default async function pMap<T, R>(
  iterable: Iterable<T>,
  mapper: (item: T, index: number) => Promise<R> | R,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  for (const item of iterable) {
    results.push(await mapper(item, index));
    index += 1;
  }

  return results;
}

export { pMap };
