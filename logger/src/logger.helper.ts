import { envToArray } from '@nestjs-yalc/utils/env.helper.js';
import { LogLevel } from '@nestjs/common';
import fastRedact from 'fast-redact';
import { isEmpty } from 'lodash-es';
import { LOG_LEVEL_ALL, LoggerDefContext } from './logger.enum.js';

export function maskDataInObject(data?: any, paths?: string[], trace?: any) {
  if (typeof data === 'string') data = { message: data };

  if (!paths || !data || isEmpty(paths) || isEmpty(data)) {
    if (trace) data ? (data.trace = trace) : (data = { trace });

    return data;
  }

  const redact = fastRedact({
    paths,
  });

  return { ...JSON.parse(redact(data)), trace };
}

export const getEnvLoggerLevelsByContext = (context: string): LogLevel[] => {
  return envToArray<LogLevel>(`NEST_LOGGER_LEVELS_${context.toUpperCase()}`);
};

export const getEnvLoggerLevels = (
  context?: string,
  def: LogLevel[] = LOG_LEVEL_ALL,
): LogLevel[] => {
  let levels = getEnvLoggerLevelsByContext(
    context ?? LoggerDefContext.NEST_SYSTEM,
  );

  if (!levels.length) levels = envToArray<LogLevel>('NEST_LOGGER_LEVELS');

  return levels.length ? levels : def;
};
