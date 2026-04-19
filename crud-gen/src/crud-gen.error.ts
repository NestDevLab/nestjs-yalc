import { GqlError } from '@nestjs-yalc/graphql/plugins/gql.error.js';
import { FilterErrors } from './strings.enum.js';

export class CrudGenError extends GqlError {
  constructor(
    message?: string,
    public systemMessage?: string,
  ) {
    super(message, systemMessage);
  }
}

export class CrudGenInvalidArgumentError extends CrudGenError {
  constructor() {
    super(FilterErrors.INVALID_ARGUMENT);
  }
}

export class CrudGenInvalidOperatorError extends CrudGenError {
  constructor() {
    super(FilterErrors.INVALID_OPERATOR);
  }
}

export class CrudGenInvalidPropertyError extends CrudGenError {
  constructor() {
    super(FilterErrors.INVALID_PROPERTY);
  }
}

export class CrudGenConditionNotSupportedError extends CrudGenError {
  constructor(info?: string) {
    super(FilterErrors.INVALID_CONDITION + (info ? `: ${info}` : ''));
  }
}

export class CrudGenFilterNotSupportedError extends CrudGenError {
  constructor(info?: string) {
    super(FilterErrors.FILTER_NOT_SUPPORTED + (info ? `: ${info}` : ''));
  }
}

export class CrudGenBadFilterTypeError extends CrudGenError {
  constructor() {
    super(FilterErrors.BAD_FILTER_TYPE);
  }
}

export class CrudGenNotPossibleError extends CrudGenError {
  constructor() {
    super(FilterErrors.NOT_POSSIBLE_EXCEPTION);
  }
}

export class CrudGenStringWhereError extends CrudGenError {
  constructor() {
    super(FilterErrors.STRING_WHERE);
  }
}

export class CrudGenFilterProhibited extends CrudGenError {
  constructor() {
    super(FilterErrors.FILTER_PROHIBITED);
  }
}
