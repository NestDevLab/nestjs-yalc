# @nestjs-yalc/utils

General-purpose utility helpers used across YALC packages.

The package includes helpers for classes, objects, dates, environment values,
validation, encryption, compression, RxJS, command execution, files, math, and
configuration management.

## Installation

```bash
npm install @nestjs-yalc/utils
```

## Main Exports

- Class, object, enum, data structure, and object-mapper helpers.
- Date, interval, math, and return-value helpers.
- Environment and configuration manager helpers.
- Validation helpers and custom validators.
- Encryption, zlib, command, file, and RxJS helpers.
- Nest decorator and interceptor helpers.

## Example

```ts
import { envIsTrue } from '@nestjs-yalc/utils/env.helper.js';

const featureEnabled = envIsTrue(process.env.FEATURE_ENABLED ?? 'false');
```
