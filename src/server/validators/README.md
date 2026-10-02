# validators

Zod schemas for request bodies, query strings and forms (Phase 1+). One file per resource
(`batch.validator.ts`). Controllers parse with them, and client forms reuse them through the
React Hook Form resolver, so the API and the UI enforce the same rules.
