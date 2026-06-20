# @nestjs-yalc/aws-helpers

Small AWS helpers used by YALC applications.

The package currently focuses on Lambda CLI execution and AWS Systems Manager
Parameter Store decryption helpers for loading environment variables at
runtime.

## Installation

```bash
npm install @nestjs-yalc/aws-helpers
```

## Main Exports

- `runLambdaCliOperation` for executing a Lambda-style CLI operation.
- `decryptSsmVariable` for decrypting one SSM parameter value.
- `setEnvironmentVariablesFromSsm` for loading selected SSM parameters into
  `process.env`.
- `EncryptMode` and `AwsResponse` supporting types.

## Example

```ts
import { setEnvironmentVariablesFromSsm } from '@nestjs-yalc/aws-helpers';

await setEnvironmentVariablesFromSsm({
  DATABASE_PASSWORD: '/service/database/password',
});
```
