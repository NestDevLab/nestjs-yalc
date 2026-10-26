import { expect, it } from '@jest/globals';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

it('typechecks entity-aware and compatibility inputs with active TypeScript diagnostics', () => {
  const configPath = fileURLToPath(
    new URL('../../../tsconfig.json', import.meta.url),
  );
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  expect(config.error).toBeUndefined();
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    fileURLToPath(new URL('../../../', import.meta.url)),
  );
  const program = ts.createProgram({
    rootNames: [
      fileURLToPath(
        new URL('./fixtures/graphql-input-types.ts', import.meta.url),
      ),
    ],
    options: {
      ...parsed.options,
      noEmit: true,
      incremental: false,
      composite: false,
    },
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  expect(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getCanonicalFileName: (name) => name,
      getNewLine: () => '\n',
    }),
  ).toBe('');
}, 60_000);
