export const MUTATION_JOURNAL_OPTIONS = Symbol(
  'nestjs-yalc:mutation-journal:options',
);

export const MUTATION_JOURNAL_DRIVERS = Symbol(
  'nestjs-yalc:mutation-journal:drivers',
);

export const DEFAULT_JOURNAL_TABLE = '_mutation_journal';

export const BUILTIN_EXCLUDED_TABLES = ['migrations', 'typeorm_metadata'];

export const DEFAULT_READ_LIMIT = 100;
