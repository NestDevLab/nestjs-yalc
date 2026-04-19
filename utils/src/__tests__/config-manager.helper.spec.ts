import { describe, expect, it } from '@jest/globals';
import { ConfigValueManager, checkForDuplicateKeys } from '../config-manager.helper.js'; // Adjust the import path accordingly

describe('ConfigValueManager and Utilities', () => {

  describe('checkForDuplicateKeys', () => {
    it('should not throw an error for unique keys', () => {
      const execute = () => checkForDuplicateKeys(['key1', 'key2', 'key3']);
      expect(execute).not.toThrow();
    });

    it('should throw an error for duplicate keys', () => {
      const execute = () => checkForDuplicateKeys(['key1', 'key1']);
      expect(execute).toThrow(/Duplicate key found in configuration: key1/);
    });
  });

  describe('ConfigValueManager.value', () => {
    it('returns the correct value for a matching key', () => {
      const result = ConfigValueManager.value('myKey', {k: 'myKey', v: 'myValue'});
      expect(result).toBe('myValue');
    });

    it('returns the default value when key does not match', () => {
      const result = ConfigValueManager.value('otherKey', { k: 'myKey', v: 'myValue' }, 'default');
      expect(result).toBe('default');
    });

    it('returns the value from a function when key matches', () => {
      const result = ConfigValueManager.value('myKey', { k: 'myKey', v: () => 'dynamicValue' });
      expect(result).toBe('dynamicValue');
    });

    it('returns the default value from a function when key does not match', () => {
      const result = ConfigValueManager.value('otherKey', { k: 'myKey', v: 'myValue' }, () => 'dynamicDefault');
      expect(result).toBe('dynamicDefault');
    });

    it('handles multiple configurations and returns the first matching value', () => {
      const configs = [{ k: 'myKey1', v: 'value1' }, { k: 'myKey2', v: 'value2' }];
      const result = ConfigValueManager.value('myKey2', configs);
      expect(result).toBe('value2');
    });

    it('throws an error for duplicate keys in configurations', () => {
      const configs = [{ k: 'myKey', v:'value1'}, { k: 'myKey', v: 'value2'}];
      const execute = () => ConfigValueManager.value('myKey', configs);
      expect(execute).toThrow(/Duplicate key found in configuration: myKey/);
    });
  });

  describe('ConfigValueManager.is', () => {
    it('returns true when the key matches', () => {
      const result = ConfigValueManager.is('myKey', 'myKey');
      expect(result).toBe(true);
    });

    it('returns false when the key does not match', () => {
      const result = ConfigValueManager.is('otherKey', 'myKey');
      expect(result).toBe(false);
    });

    it('returns false when using negation and the key matches', () => {
      const result = ConfigValueManager.is('myKey', 'myKey', true);
      expect(result).toBe(false);
    });
  });

  describe('ConfigValueManager.only', () => {
    it('returns the value for a matching key', () => {
      const result = ConfigValueManager.only('myKey', 'myKey', 'returnValue');
      expect(result).toBe('returnValue');
    });

    it('returns undefined for a non-matching key', () => {
      const result = ConfigValueManager.only('otherKey', 'myKey', 'returnValue');
      expect(result).toBeUndefined();
    });
  });

  describe('ConfigValueManager.skip', () => {
    it('returns undefined for a matching key', () => {
      const result = ConfigValueManager.skip('myKey', 'myKey', 'returnValue');
      expect(result).toBeUndefined();
    });

    it('returns the value for a non-matching key', () => {
      const result = ConfigValueManager.skip('otherKey', 'myKey', 'returnValue');
      expect(result).toBe('returnValue');
    });
  });

});
