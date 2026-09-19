# Learning Loop Runtime Contract

Status: accepted for Phase 0  
Scope: `learningJourney` storage and lifecycle only

## Decision

The learning loop will use one app-defined RuntimeStore session kind named
`learningJourney`. The DSL intentionally defines `RuntimeSession.kind` as an
open `string`; `CoreRuntimeKind` lists built-in names but is not a storage
allowlist. The learning loop therefore does not need to add its kind to the
core DSL union.

An app payload validator must be registered before journey records are written.
The same `APP_RUNTIME_PAYLOAD_VALIDATORS` table is already passed to the default
browser store, the server-side PostgreSQL store, and the persistence HTTP
handler. Adding the validator to this table keeps all three paths aligned.

## Lifecycle guarantees

RuntimeStore lifecycle operations work across all session kinds rather than a
hard-coded core-kind list:

- `mergeLearner(from, to)` moves every source learner session across stages;
- `deleteStageRuntime(stageId)` removes every learner session and record for the
  stage;
- `deleteAllRuntime()` removes every runtime session and record;
- learner and stage partitioning remain owned by RuntimeStore, not by learning
  loop UI code.

The shared RuntimeStore conformance suite now exercises these guarantees with a
`learningJourney` session. Because browser and PostgreSQL implementations both
run the suite, a backend cannot silently diverge. HTTP storage delegates these
operations to the same server contract and already has route conformance tests.

## Proposed session boundary

Phase 2 will create one journey session for each `(stageId, learnerKey)` pair.
The stable identifier will be derived by application code; records will be
immutable events with deterministic event IDs. Current component state will be
folded from records and will not be stored as the sole source of truth.

## Payload validation boundary

Phase 0 does not register a placeholder validator because accepting a temporary
shape would create stored data that Phase 2 must migrate. Phase 2 must land the
versioned learning evidence types, validator, and RuntimeStore writer together.

The validator must:

- accept only known event types and `schemaVersion: 1`;
- require stage, learner, component, event, source, outcome, and timestamp
  fields needed by the fold;
- reject `undefined`, malformed timestamps, unknown outcomes, and mismatched
  session/event identities;
- fail closed on writes while readers skip unsupported future record versions
  with diagnostics.

## Failure behavior

Learning evidence is supporting runtime data. A failed write must not block
scene playback, quiz review, or chat. The UI should retain a retryable local
state and show a non-blocking warning. Stage deletion remains fail-soft and
bounded by the existing runtime deletion timeout.

## Compatibility conclusion

- No Dexie document schema migration is needed for the MVP.
- No Stage or Scene DSL change is needed for the derived knowledge model.
- No core runtime kind change is needed.
- The feature remains invisible while
  `NEXT_PUBLIC_LEARNING_LOOP_ENABLED` is disabled.
- AI repair generation remains independently controlled by the server-only
  `OPENMAIC_LEARNING_LOOP_AI_ENABLED` flag.

## Phase 0 verification

Verified on 2026-09-19:

- application Feature Flag and Quiz runtime baseline: 81 tests passed;
- RuntimeStore browser, PostgreSQL, HTTP, and reference-server suites: 231 tests
  passed;
- `@openmaic/storage` source and test TypeScript checks passed;
- the full storage suite has one reproducible, unrelated multipart parser
  baseline failure in `http-asset-store.test.ts`; its expected generic malformed
  body message differs from the platform parser's more specific meta-part
  message.

Commands:

```text
pnpm vitest run tests/config/feature-flags.test.ts tests/quiz/runtime.test.ts tests/quiz/runtime-read.test.ts
pnpm -C packages/@openmaic/storage exec vitest run test/runtime-browser.test.ts test/pg-runtime-store.test.ts test/http-runtime-store.test.ts test/runtime-reference-server.test.ts
pnpm --filter @openmaic/storage typecheck
```
