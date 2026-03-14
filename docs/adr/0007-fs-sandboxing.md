# ADR-007: Multiplic Studio — File System Sandboxing

**Status:** Accepted
**Date:** 2026-03-12
**Depends on:** ADR-006

## Context

Studio reads and writes files on behalf of the authenticated user. Without
sandboxing, a compromised session or a path traversal bug could expose or
overwrite arbitrary server files.

## Decision

Every file-system operation passes through `assertSafePath(userInput)`:

1. **Reject `../` before resolution.** If the raw input contains `..` as a path
   segment, return `403` immediately before any filesystem call.
2. **Resolve to absolute path.** `const abs = path.resolve(REPO_ROOT, userInput)`.
3. **startsWith assertion.** If `abs` does not start with `REPO_ROOT + path.sep`
   (and is not exactly `REPO_ROOT`), return `403`.
4. **Symlink resolution.** After the startsWith check, call `fs.realpathSync(abs)`
   and repeat the startsWith check on the result to catch symlink escapes.
5. **Deny-list.** Reject any path whose resolved form matches:
   - `**/.env` (any `.env` file at any depth)
   - `**/.git/**` (git internals)
   - `**/node_modules/**`
6. **File size limit.** Read operations on files larger than **5 MB** return
   `413 Payload Too Large`.
7. **Write operations.** Only `PUT` (update existing) and `POST` (create new) are
   supported. `DELETE` is **not** implemented in v1 to reduce blast radius.

`REPO_ROOT` is set to `process.env.MULTIPLIC_REPO_PATH` or falls back to three
directory levels above `server/studio/services/`.

## Consequences

- ✅ Double-checked path resolution defeats both directory traversal and symlink attacks.
- ✅ Deny-list prevents accidental exposure of credentials and git internals.
- ✅ 5 MB cap prevents memory exhaustion from large binary reads.
- ⚠️ Operators must ensure `MULTIPLIC_REPO_PATH` is set correctly; wrong value
  silently changes the sandbox root.

## Rejected Alternatives

- **chroot/container per request:** Correct but enormous operational overhead for a
  dev tool.
- **Allowlist of permitted paths:** Too restrictive; developers need to edit any site
  file.
