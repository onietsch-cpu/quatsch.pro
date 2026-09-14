# Long screenshot translation — 2026-09-14

The user's clarification concerns text capacity in uploaded screenshots. The root cause was the shared `max_tokens: 300` budget: photo output contains both OCR source text and the translation, so moderately long screenshots could already exhaust it and return invalid/truncated JSON.

The image route now requests 16,384 output tokens, high-detail image input and a complete translation preserving paragraphs and reading order. It gets a dedicated 120-second provider deadline. Upload format/size remains JPG/PNG/WebP up to 8 MiB; file bytes are distinct from the number of readable characters. These settings are bounded and are not a promise of unlimited text or OCR accuracy. GPT-4.1 mini, the code default, supports this budget: https://developers.openai.com/api/docs/models/gpt-4.1-mini .

A provider `finish_reason: length` is rejected with an actionable HTTP 422 instead of treating partial output as a finished translation. Missing translations are rejected. Automatic image retries are disabled on both client and provider paths, preventing repeated long billed requests; the visible manual retry remains. The UI explains the wait and preserves paragraph breaks and long words.

Validation before publication: lint, 65 tests and production build pass. New tests exercise long OCR/translation output through the image handler without clipping, the 16,384-token budget, the 120-second deadline, no automatic retry, truncated parseable JSON, missing translations and preservation of the non-image token default. Live screenshot verification is recorded separately after rollout.
