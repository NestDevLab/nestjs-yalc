export enum GqlErrorMsgs {
  MAX_OPERATIONS = 'The request has too many operations.',
  MAX_DEPTH = 'The request has reached the max depth allowed.',
  CIRCULAR_DEPENDENCY_FOUND = 'The request has a circular dependency.',
}

export class GqlError extends Error {
  constructor(
    message?: string,
    public systemMessage?: string,
  ) {
    super(message);
  }
}
