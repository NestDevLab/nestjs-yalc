import { Controller } from '@nestjs/common';
import { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';

@Controller()
export class KafkaController<Entity extends ObjectLiteral> {
  constructor(protected repository: Repository<Entity>) {}

  /**
   * Check function for filtering target with specific value on a key
   * @param target Entity
   * @param key Key of the Entity fields
   * @param value Value to filter
   * @returns true if match - false otherwise
   */
  checkTargetValue<Entity, U extends keyof Entity>(
    target: Entity,
    key: U,
    value: Array<Entity[U]>,
  ): boolean {
    return value.includes(target[key]);
  }

  /**
   * Save entity on Database
   * @param entity
   * @returns
   */
  async saveEntity(entity: QueryDeepPartialEntity<Entity>) {
    return this.repository.insert(entity);
  }

  /**
   * Save the entity or Update in case of confitColumn
   * @param entity
   * @param overWrite
   * @param conflitTarget
   * @returns
   */
  async saveEntityOrUpdate(
    entity: QueryDeepPartialEntity<Entity>,
    overWrite: string[],
    conflitTarget?: string | string[],
  ) {
    return this.repository
      .createQueryBuilder()
      .insert()
      .values(entity)
      .orUpdate(overWrite, conflitTarget)
      .execute();
  }

  /**
   * Delete the entity
   * @param conditions
   * @returns
   */
  async deleteEntity(conditions: FindOptionsWhere<Entity>) {
    return this.repository.delete(conditions);
  }
}
