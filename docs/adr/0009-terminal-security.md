# ADR-009: Multiplic Studio — Terminal Security

**Status:** Accepted
**Date:** 2026-03-12
**Depends on:** ADR-006, ADR-007

## Context

A browser-accessible terminal is the highest-risk Studio feature. Arbitrary command
execution must be constrained to the repository and cannot be allowed to affect the
host system beyond the repo root.

## Decision

1. **Restricted shell.** `node-pty` spawns `bash --restricted --noprofile --norc`.
   Restricted bash (`rbash`) prevents `cd` to arbitrary directories, redirections to
   files outside CWD, and execution of commands with `/` in the name.
2. **CWD locked to `REPO_ROOT`.** The PTY is spawned with `cwd: REPO_ROOT`.
   `rbash` prevents `cd` escapes.
3. **Sanitized environment.** The child process receives only a curated env:
   `HOME`, `TERM`, `PATH` (minimal read-only), `LANG`, `MULTIPLIC_REPO_PATH`.
   Secrets (`STUDIO_PASSWORD`, `STUDIO_AI_KEY`, `SYNC_SECRET`, `SESSION_SECRET`) are
   explicitly excluded from the child environment.
4. **Session limits.** Maximum **2 concurrent PTY sessions** per authenticated Studio
   instance. A third `POST /_studio/api/terminal/create` returns `429`.
5. **Idle timeout.** PTY sessions idle for **30 minutes** (no I/O) are automatically
   killed and removed from the session map.
6. **WebSocket transport.** Each terminal has a WebSocket at
   `/_studio/api/terminal/:id`. Binary frames carry PTY output; text frames carry
   resize commands `{"cols":N,"rows":N}`.

## Consequences

- ✅ `rbash` meaningfully reduces blast radius of a compromised session.
- ✅ Sanitized env ensures AI keys and sync secrets are never visible in the terminal.
- ✅ Concurrent session cap prevents resource exhaustion.
- ⚠️ `rbash` is not a security boundary; a determined attacker with write access can
  escape it. The real boundary is ADR-006 authentication.
- ⚠️ Some legitimate developer workflows (e.g., `cd ../other-site`) are blocked by
  `rbash`. Operators who need unrestricted terminals should not expose Studio to the
  public internet.

## Rejected Alternatives

- **Command whitelist (allow only git/npm/etc.):** Too brittle; developers need
  general shell access for debugging.
- **Docker container per session:** Correct security model but impractical for a
  self-hosted single-process server.
