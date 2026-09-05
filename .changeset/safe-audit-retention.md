---
'@nestjs-yalc/audit': major
---

Remove in-process mutation-journal retention cleanup and scheduling. Retention must run through a governed host command with coordination and durable failure evidence.
