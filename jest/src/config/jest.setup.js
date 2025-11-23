/* istanbul ignore file */

process.env.NODE_ENV = 'test';

// without this, jest won't fail with unhandled promises
// (e.g. missing awaits)
if (!process.env.LISTENING_TO_UNHANDLED_REJECTION) {
  process.on('unhandledRejection', (err) => {
    throw err;
  });
  // Avoid memory leak by adding too many listeners
  process.env.LISTENING_TO_UNHANDLED_REJECTION = 'true';
}
