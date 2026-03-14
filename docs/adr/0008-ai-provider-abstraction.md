# ADR-008: Multiplic Studio — AI Provider Abstraction

**Status:** Accepted
**Date:** 2026-03-12
**Depends on:** ADR-006, ADR-007

## Context

AI API keys must not be exposed to the browser. Different operators prefer
different LLM providers. Streaming responses are required for good UX.

## Decision

1. **Server-side proxy.** The browser sends messages to
   `GET /_studio/api/ai/stream?message=...`. The server holds the API key and
   forwards to the configured provider.
2. **Pluggable provider.** `STUDIO_AI_PROVIDER` selects the backend: `openai`
   (default), `anthropic`, `ollama`, or `custom`. Each provider is a module in
   `server/studio/services/aiProviders/` that exports `{ stream(messages, res) }`.
3. **SSE transport.** The route sets `Content-Type: text/event-stream` and streams
   tokens as `data: <token>\n\n` events. The browser uses `EventSource`.
4. **Context injection.** Before forwarding, the server prepends a system prompt
   containing:
   - The current file's content (passed as `?file=<path>` query param, sandboxed
     via `assertSafePath`).
   - A compact summary of `multiplic.json` (site keys and frameworks only; no
     secrets).
   - `wpBase` URL if the current site declares it (ADR-005 compliance).
5. **Rate limiting.** 30 AI requests per minute per session. Exceeding returns `429`.
6. **Key storage.** `STUDIO_AI_KEY` env var. Never logged, never sent to client.

## Supported Providers

| `STUDIO_AI_PROVIDER` | Default model |
|---|---|
| `openai` (default) | `gpt-4o` |
| `anthropic` | `claude-3-5-sonnet-20241022` |
| `ollama` | `llama3` (no key needed; local) |
| `custom` | set via `STUDIO_AI_MODEL`; `STUDIO_AI_BASE_URL` required |

## Consequences

- ✅ API keys never reach the browser.
- ✅ Switching providers requires only an env-var change.
- ✅ Ollama support enables fully offline/air-gapped use.
- ⚠️ SSE does not support request cancellation from the server side in all Node
  versions; use `req.on('close', ...)` to abort the upstream fetch.

## Rejected Alternatives

- **Direct browser-to-LLM calls:** Exposes API key; violates separation of concerns.
- **WebSocket for AI:** Adds complexity without benefit over SSE for unidirectional
  streaming.
