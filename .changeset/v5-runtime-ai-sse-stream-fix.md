---
'@objectstack/runtime': patch
---

Fix: AI streaming endpoints (e.g. `POST /api/v1/ai/assistant/chat`) now
actually stream Server-Sent Events instead of returning the stream
descriptor JSON-serialized.

The shared `sendResultBase()` in `dispatcher-plugin.ts` previously had a
`// pass through as JSON for now` TODO, so any dispatcher route whose
`result.result` was a stream descriptor (`{ type: 'stream', events,
headers, ... }`) would respond with a literal `{"type":"stream",
"events":{},"vercelDataStream":true,...}` body — breaking
`@object-ui/plugin-chatbot` and any other Vercel-AI-SDK consumer.

The dispatcher now:

- Detects `{ type: 'stream' | stream: true, events, headers? }` shapes.
- Applies the route-provided headers (defaults to
  `text/event-stream`/`no-cache`/`keep-alive` when none are supplied).
- Performs an empty `res.write('')` synchronously so the Hono adapter's
  `isStreaming` flag flips before the route handler resolves (the adapter
  would otherwise close the body before the first async chunk lands).
- Drains the `AsyncIterable<string>` of pre-encoded SSE chunks in the
  background, calling `res.end()` when the iterator finishes or errors.

Non-stream `result.result` payloads keep the existing JSON behaviour.
