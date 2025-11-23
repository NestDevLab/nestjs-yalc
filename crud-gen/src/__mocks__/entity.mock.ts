import { returnProperty } from '@nestjs-yalc/utils/returnValue.js';
import {
  BaseEntity,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ModelField, ModelObject } from '../object.decorator.js';

@Entity()
export class TestEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;
}

@ModelObject()
export class TestEntityDto extends TestEntity {
  @ModelField({ gqlOptions: { name: 'entityId' } })
  id: number;
}

export class TestEntityRelation extends TestEntity {
  @OneToMany(
    () => TestEntityRelation2,
    returnProperty<TestEntityRelation2>('TestEntityRelation'),
  )
  @JoinColumn({
    name: 'TestEntityRelation',
    referencedColumnName: 'TestEntityRelation',
  })
  TestEntityRelation2!: any;
}

export class TestEntityRelation2 extends TestEntity {
  @ManyToOne(
    () => TestEntityRelation,
    returnProperty<TestEntityRelation>('TestEntityRelation2'),
  )
  @JoinColumn({
    name: 'TestEntityRelation2',
    referencedColumnName: 'TestEntityRelation2',
  })
  TestEntityRelation!: any;
}
