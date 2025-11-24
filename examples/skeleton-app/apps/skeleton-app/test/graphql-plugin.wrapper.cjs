const plugin = require('@nestjs/graphql/plugin');

module.exports = {
  name: 'nestjs-graphql-plugin-wrapper',
  version: 1,
  /**
   * ts-jest expects a factory returning a transformer.
   * The Nest GraphQL plugin exposes a `before` hook taking (options, program).
   */
  factory(cs) {
    // `cs` is the ts-jest TsCompiler instance; `program` may not be
    // available in all compilation modes, so fall back to a no-op.
    if (!cs.program) {
      return (ctx) => (sf) => sf;
    }

    return plugin.before(
      {
        typeFileNameSuffix: [
          '.dto.ts',
          '.input.ts',
          '.args.ts',
          '.entity.ts',
          '.model.ts',
        ],
      },
      cs.program,
    );
  },
};
