import type { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';
import type { OmniScope } from './omni-scope.js';

/**
 * Small repository facade for normal Omni lookups. It mechanically adds the
 * current scope and is the supported lower-level alternative to passing raw
 * repositories between application layers.
 */
export class OmniScopedRepository<Entity extends ObjectLiteral> {
  constructor(
    private readonly repository: Repository<Entity>,
    private readonly scope: OmniScope,
  ) {}

  where(
    where: FindOptionsWhere<Entity> = {} as FindOptionsWhere<Entity>,
  ): FindOptionsWhere<Entity> {
    if ('scopeId' in (where as object)) {
      throw new TypeError('Omni scopeId is derived from server context.');
    }
    return {
      ...(where as object),
      scopeId: this.scope.scopeId,
    } as unknown as FindOptionsWhere<Entity>;
  }

  findOneByGuid(guid: string): Promise<Entity | null> {
    return this.repository.findOne({ where: this.where({ guid } as never) });
  }

  find(where: FindOptionsWhere<Entity> = {} as FindOptionsWhere<Entity>) {
    return this.repository.find({ where: this.where(where) });
  }
}
