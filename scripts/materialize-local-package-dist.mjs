import { materializeLocalPackageDists } from './local-package-dist.mjs';

const packages = materializeLocalPackageDists();
console.log(`Materialized local package boundaries: ${packages.join(', ')}`);
