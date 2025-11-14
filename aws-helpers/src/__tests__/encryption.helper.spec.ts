import {
  expect,
  jest,
  describe,
  it,
  beforeEach,
} from '@jest/globals';
import { GetParameterCommandOutput } from '@aws-sdk/client-ssm';

const $ = await import('../encryption.helper.js');

const mockSSMSend = jest.fn();
const mockSSMClient = {
  send: mockSSMSend,
};

jest.mock('@aws-sdk/client-ssm', () => {
  return {
    SSMClient: jest.fn(() => mockSSMClient),
    GetParameterCommand: jest.fn((params) => params),
  };
});

describe('Encryption/Decryption Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle SSM variable decryption with cache', async () => {
    mockSSMClient.send = jest.fn().mockImplementationOnce(() => ({
      Parameter: { Value: 'ssmDecrypted' },
    }));

    const result = await $.decryptSsmVariable('toDecrypt');
    expect(result).toBe('ssmDecrypted');
  });

  it('should handle SSM variable decryption with cache without value', async () => {
    mockSSMClient.send = jest.fn().mockImplementationOnce(() => ({
      Parameter: null,
    }));

    const result = await $.decryptSsmVariable('toDecryptNull', true);
    expect(result).toBe('');
  });

  it('should handle SSM variable decryption with cache with empty value', async () => {
    mockSSMClient.send = jest.fn().mockImplementationOnce(() => ({
      Parameter: {},
    }));

    const result = await $.decryptSsmVariable('toDecryptNoValue');
    console.log('result', { result, toDecryptNoValue: 'toDecryptNoValue' });
    expect(result).toBe('');
  });

  it('should handle SSM variable decryption with cache with empty value...again', async () => {
    mockSSMClient.send = jest.fn().mockImplementationOnce(() => ({
      Parameter: {},
    }));

    const result = await $.decryptSsmVariable('toDecryptNoValue');
    expect(result).toBe('');
  });

  it('should handle SSM variable decryption error', async () => {
    mockSSMClient.send = jest.fn().mockImplementationOnce(() => {
      throw new Error('SSM Error');
    });

    const result = await $.decryptSsmVariable('toDecrypt', false);
    expect(result).toBe('');
  });

  it('should set environment variables from SSM', async () => {
    mockSSMClient.send = jest.fn().mockImplementationOnce(() => ({
      Parameter: { Value: 'ssmDecrypted' },
    }));

    const envVars = { TEST_VAR: 'ssmVar' };
    const result = await $.setEnvironmentVariablesFromSsm(envVars, false);
    expect(result).toEqual({ TEST_VAR: 'ssmDecrypted' });
    expect(process.env.TEST_VAR).toBe('ssmDecrypted');
  });

  it('should set environment variables from SSM with cache', async () => {
    mockSSMClient.send = jest.fn().mockImplementationOnce(() => ({
      Parameter: { Value: 'ssmDecrypted' },
    }));

    const envVars = { TEST_VAR: 'ssmVar' };
    const result = await $.setEnvironmentVariablesFromSsm(envVars);
    expect(result).toEqual({ TEST_VAR: 'ssmDecrypted' });
    expect(process.env.TEST_VAR).toBe('ssmDecrypted');
  });

  it('should handle concurrent SSM variable decryption with cache', async () => {
    mockSSMClient.send = jest.fn().mockReset();
    // Mock SSM send to return a promise that resolves after 100ms
    mockSSMClient.send.mockReturnValue(
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              Parameter: { Value: 'ssmDecrypted' },
            } as GetParameterCommandOutput),
          100,
        ),
      ),
    );

    // Make concurrent calls to decryptSsmVariable
    const promises = Array(5)
      .fill(null)
      .map(() => $.decryptSsmVariable('concurrentDecrypt', true));

    // Wait for all promises to resolve
    const results = await Promise.all(promises);

    // Check that all promises resolved to the same value
    expect(results).toEqual(Array(5).fill('ssmDecrypted'));

    // Check that SSM send was called only once
    expect(mockSSMClient.send).toHaveBeenCalledTimes(1);
  });
});
