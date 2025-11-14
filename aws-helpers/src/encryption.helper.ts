import { Logger } from '@nestjs/common';
import {
  GetParameterCommand,
  GetParameterCommandOutput,
  SSMClient,
} from '@aws-sdk/client-ssm';

/**
 *  Used for everything locally, must still be passed since sometimes we want to use other keys
 * (think encryptionKey on for example user identity document)
 * @todo put this in a config file
 */
export const staticKey =
  'be088f8bb64166cc2938b1dd0c9db8fa223edd975f48462858a41f70ebee1c5f';

export enum EncryptMode {
  AWS,
  LOCAL,
}

// return reject to prevent further func execution (although promise result won't change after reject/resolve)
// also guarantees typescript safety
const cachedSsmVariables = new Map<
  string,
  Promise<GetParameterCommandOutput>
>();

export const decryptSsmVariable = async (
  toDecrypt: string,
  useCache: boolean = true,
): Promise<string> => {
  if (useCache) {
    if (cachedSsmVariables.has(toDecrypt)) {
      const cachedValue = cachedSsmVariables.get(toDecrypt)!;

      const value = await cachedValue;
      return value.Parameter?.Value ?? '';
    }
  }

  const ssm = new SSMClient();
  try {
    const dataPromise = ssm.send(
      new GetParameterCommand({
        Name: toDecrypt,
        WithDecryption: true,
      }),
    );

    if (useCache) {
      cachedSsmVariables.set(toDecrypt, dataPromise);
    }

    const data = await dataPromise;

    return data.Parameter?.Value ?? '';
  } catch (err) {
    Logger.error(
      `Error while decrypting ssm variable ${toDecrypt} ${JSON.stringify(err)}`,
    );
    return '';
  }
};

export const setEnvironmentVariablesFromSsm = async (
  envVariableToDecrypt: Record<string, string>,
  useCache: boolean = true,
): Promise<Record<string, string>> => {
  const ssmVars: Record<string, string> = {};
  const promises = Object.entries(envVariableToDecrypt).map(
    async ([envVar, ssmVar]) => {
      const value = await decryptSsmVariable(ssmVar, useCache);
      process.env[envVar] = ssmVars[envVar] = value;

      // Logger.debug(`Process env: ${envVar} set to ${process.env[envVar]}`);
    },
  );

  await Promise.all(promises);
  return ssmVars;
};
