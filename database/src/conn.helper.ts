import { DataSource } from 'typeorm';

export const DBCONF_PREFIX = 'dbConf_';
export const CONN_SUFFIX = 'Connection';

export function getConfNameByConnection(connName: string) {
  return `${DBCONF_PREFIX}${connName}`;
}

export function getConnectionName(dbName: string) {
  return `${dbName}${CONN_SUFFIX}`;
}

export function getDBNameByConnection(connName: string) {
  return connName.substring(0, connName.indexOf(CONN_SUFFIX));
}

const readString = (value: unknown) =>
  typeof value === 'string' ? value : undefined;

export const dbConnectionMap = (c: DataSource) => ({
  conn: c,
  dbName:
    readString(c.options.database) ??
    readString(c.driver.schema) ??
    getDBNameByConnection(
      readString(c.name) ?? readString(c.options.name) ?? '',
    ),
});
