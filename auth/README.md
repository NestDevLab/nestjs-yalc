# @nestjs-yalc/auth

`createAuthCore` provides an opaque, provider-independent session lifecycle. It accepts
verified proof, account resolution, transactional session storage, a clock and cryptographic
random bytes as injected host ports. The package does not expose HTTP routes, proof
protocols, identity provisioning or a persistent storage adapter.

```ts
import { randomBytes } from "node:crypto";
import { createAuthCore } from "@nestjs-yalc/auth";

const core = createAuthCore({
  namespace: "my-app",
  absoluteTtlMs: 86_400_000,
  idleTtlMs: 3_600_000,
  allowedOrigins: ["https://app.example"],
  providers,
  resolveIdentity,
  sessions,
  now: Date.now,
  randomBytes,
});
```

The host must bind the request context to its actual cookie or bearer transport. Cookie
mutations require an exact configured origin, reject cross-site requests and verify the
session CSRF secret. The host must authorize `revokeAll` separately. The injected
`sessions.transaction` must serialize, commit and roll back session, token and outbox
changes atomically; an in-memory test fixture is insufficient for production. Tokens
and CSRF secrets are stored only as SHA-256 digests. Host event delivery uses the
committed outbox and needs its own deduplication and acknowledgment proof.

See the [session-core contract](https://github.com/NestDevLab/nestjs-yalc/blob/dev/docs/auth/session-core-v1.md) for the full
port, lifecycle and error contract. Refresh reuse revokes the session family, including
when simultaneous refresh attempts race. Clients should serialize refresh attempts.
