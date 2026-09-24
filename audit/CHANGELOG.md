# @nestjs-yalc/audit

## 2.0.0

### Major Changes

- dc6cea1: Remove in-process mutation-journal retention cleanup and scheduling. Retention must run through a governed host command with coordination and durable failure evidence.

## 1.4.0

### Minor Changes

- ad920d0: Add trigger-based database mutation journaling with a SQLite driver, NestJS
  module services, and query and retention cleanup support.
