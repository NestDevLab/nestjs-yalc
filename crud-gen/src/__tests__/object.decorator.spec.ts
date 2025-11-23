import { jest } from '@jest/globals';
import {
  ModelField,
  CrudGenObject,
  getModelFieldMetadata,
  getCrudGenObjectMetadata,
  hasModelFieldMetadata,
  hasModelFieldMetadataList,
  hasCrudGenObjectMetadata,
  IModelFieldMetadata,
} from '../object.decorator.js';
import { TestEntityDto } from '../__mocks__/entity.mock.js';
import { fixedIncludefilterOption } from '../__mocks__/filter.mocks.js';
import * as ObjectDecorator from '../object.decorator.js';

import * as NestGraphql from '@nestjs/graphql';
import { FieldOptions, ReturnTypeFunc } from '@nestjs/graphql';
import { BaseEntity } from 'typeorm';

const fixedModelFieldMetadata: IModelFieldMetadata = {
  gqlOptions: {},
  gqlType: () => String,
};

describe('ObjectDecorator', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  it('Should decorate properly a property with ModelField', () => {
    class TestObject {
      @ModelField(fixedModelFieldMetadata)
      decoratedProperty = {};

      property = 'notDecorated';
    }

    expect(hasModelFieldMetadataList(TestObject)).toBeTruthy();

    let metadata = getModelFieldMetadata(TestObject, 'decoratedProperty');
    expect([metadata.dst, metadata.src]).toEqual(
      expect.arrayContaining(['decoratedProperty', 'decoratedProperty']),
    );

    metadata = getModelFieldMetadata(TestObject, 'property');
    expect(hasModelFieldMetadata(TestObject, 'property')).toBeFalsy();
    expect(metadata).toBeUndefined();
  });

  it('Should decorate properly an object with CrudGenObject', () => {
    @CrudGenObject()
    class TestObject {
      decoratedProperty = {};
    }

    expect(hasCrudGenObjectMetadata(TestObject)).toBeTruthy();
  });

  it('Should copy the metadata from an object to another', () => {
    @CrudGenObject({ filters: fixedIncludefilterOption })
    class BaseDecoratedClass {
      @ModelField({})
      baseDecoratedProperty: 'string';
    }

    @CrudGenObject({
      copyFrom: BaseDecoratedClass,
    })
    class TestObject2 {}

    expect(hasCrudGenObjectMetadata(TestObject2)).toBeTruthy();

    const metadata = getCrudGenObjectMetadata(TestObject2);

    expect(metadata).toEqual({
      copyFrom: BaseDecoratedClass,
      filters: fixedIncludefilterOption,
    });
  });

  it('Should decorate properly a property with a custom gqlOptions', () => {
    const metadata = getModelFieldMetadata(TestEntityDto, 'id');
    expect([metadata.dst, metadata.src]).toEqual(
      expect.arrayContaining(['id']),
    );
    expect(hasModelFieldMetadata(TestEntityDto, 'id')).toBeTruthy();
  });

  it('Should ModelField work properly with default values', () => {
    jest
      .spyOn(ObjectDecorator, 'getModelFieldMetadataList')
      .mockReturnValue({});

    const addFieldSpy = jest
      .spyOn(NestGraphql as any, 'addFieldMetadata')
      .mockImplementation(jest.fn());

    let gqlOptions: FieldOptions | undefined = undefined;
    let gqlType: ReturnTypeFunc | undefined = () => BaseEntity;

    let modelFieldDecorator = ({
      gqlType,
      gqlOptions,
    });

    modelFieldDecorator({}, 'propertyKey');

    expect(addFieldSpy).toHaveBeenCalledWith(
      gqlType,
      {},
      {},
      'propertyKey',
    );
    gqlOptions = { name: 'name' };
    gqlType = undefined;

    modelFieldDecorator = ({
      gqlType,
      gqlOptions,
    });

    modelFieldDecorator({}, 'propertyKey');
    expect(addFieldSpy).toHaveBeenCalledWith(
      gqlOptions,
      gqlOptions,
      {},
      'propertyKey',
    );
    addFieldSpy.mockRestore();
  });
});
