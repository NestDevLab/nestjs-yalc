// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { useSofa } from 'sofa-api';
export const buildSofaMiddleware = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any,
  options: Parameters<typeof useSofa>[0],
) => {
  return useSofa({
    ...options,
    schema,
  });
};
