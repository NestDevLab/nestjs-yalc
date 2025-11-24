import { describe, expect, it } from '@jest/globals';
import { AppEvents } from '../app.events.js';

describe('AppEvents enum', () => {
  it('should expose the expected event names', () => {
    expect(AppEvents.BEFORE_ALL_ROUTES).toBe('app.before_all_routes');
    expect(AppEvents.AFTER_ALL_ROUTES).toBe('app.after_all_routes');
    expect(AppEvents.BEFORE_GQL_CONTEXT_MIDDLEWARE).toBe(
      'app.before_gql_context_middleware',
    );
  });
});
