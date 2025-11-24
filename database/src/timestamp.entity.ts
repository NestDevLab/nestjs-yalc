import { ClassType, Mixin } from '@nestjs-yalc/types/globals.d.js';
import returnValue from '@nestjs-yalc/utils/returnValue.js';
import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

class Base {}

export interface IEntityWithTimestamps {
  createdAt: Date;

  updatedAt: Date;
}

/**
 * This is a mixin class that can be used to implement the createdAt and updatedAt
 * Database fields in a standardized way
 *
 */
export const EntityWithTimestamps = (
  base: ClassType = Base,
): ClassType<IEntityWithTimestamps> => {
  class EntityWithTimestamps extends base implements IEntityWithTimestamps {
    /**
     * DB insert time.
     */
    @CreateDateColumn({
      // use datetime for cross-database support (e.g., SQLite)
      type: 'datetime',
      default: returnValue('CURRENT_TIMESTAMP'),
    })
    public createdAt!: Date;

    /**
     * DB last update time.
     */
    @UpdateDateColumn({
      type: 'datetime',
      default: returnValue('CURRENT_TIMESTAMP'),
      onUpdate: 'CURRENT_TIMESTAMP',
    })
    public updatedAt!: Date;
  }

  return EntityWithTimestamps;
};

export type EntityWithTimestamps = Mixin<typeof EntityWithTimestamps>;
