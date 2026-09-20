# Learning Loop Rollout Runbook

## Scope

This runbook controls the release of the evidence-based knowledge component,
repair path, tutor context, and construction report. The implementation is
default-off and can be disabled without migrating or deleting course documents.

## Flags

```env
NEXT_PUBLIC_LEARNING_LOOP_ENABLED=true
OPENMAIC_LEARNING_LOOP_AI_ENABLED=true
```

The public flag requires a rebuild. The server AI flag may remain off: the full
deterministic repair template and verification path continues to work.

## Analytics adapter

The browser dispatches `openmaic:learning-loop-analytics` with a minimized
payload containing event name, stage ID, optional component ID, optional outcome,
and timestamp. Deployments may attach an analytics adapter at bootstrap. These
events must never be written back as learning evidence or consumed by the state
fold.

Expected names:

- `learning_loop_component_viewed`
- `learning_loop_evidence_opened`
- `learning_loop_repair_suggested`
- `learning_loop_repair_started`
- `learning_loop_repair_step_completed`
- `learning_loop_verification_completed`
- `learning_loop_report_viewed`
- `learning_loop_generation_failed`

No learner key, answer text, chat text, question text, or model prompt belongs in
the analytics payload.

## Dashboard calculations

| Metric | Numerator | Denominator |
| --- | --- | --- |
| Repair start rate | repair started | repair suggested |
| Repair completion proxy | passed verification | repair started |
| Verification improvement | passed verification | all verification completions |
| Report view rate | report viewed | completed classroom sessions |
| AI fallback rate | generation failed | repair started |

Deduplicate repeated view events by stage, component, anonymous analytics
session, and a bounded time window. Do not deduplicate verification attempts.

## Release gates

Before internal enablement:

- repository checks and learning-loop tests pass;
- stage deletion and learner merge conformance pass for `learningJourney`;
- no payload contains learner answers or chat text;
- AI eval runs against all 20 scenarios with no conceptual-accuracy zero and at
  least 8/10 total per case;
- template fallback is exercised with the server AI flag off.

Before 10% rollout:

- at least five moderated task-based sessions are reviewed;
- users can explain that “已有验证” is evidence, not a formal grade;
- no Scene, Quiz draft, Interactive iframe, or playback state is lost while the
  repair panel opens and closes;
- analytics adapter and alert thresholds are live.

Before 50% and full rollout:

- compare first classroom paint and Scene-switch timings with the pre-rollout
  build;
- duplicate journey record rate remains zero after event-ID deduplication;
- AI schema failure and fallback rates are within the deployment's agreed SLO;
- RuntimeStore write failures remain non-blocking and observable;
- no cross-learner or post-deletion runtime data is detected.

## Rollback

1. Set `NEXT_PUBLIC_LEARNING_LOOP_ENABLED=false` and rebuild the client.
2. Set `OPENMAIC_LEARNING_LOOP_AI_ENABLED=false` immediately if only AI output is
   problematic; local repair remains available while the public flag is on.
3. Do not delete `learningJourney` data during an ordinary rollback. It is
   ignored while the public flag is off and remains covered by normal learner,
   Stage, and database deletion flows.
4. Preserve failing AI outputs only in the restricted eval workflow; never copy
   learner payloads into issue trackers.

## Stop conditions

Stop expansion immediately for cross-learner disclosure, unexplained state
changes, non-idempotent evidence, Scene/iframe state loss, incorrect AI content,
or user confusion that treats evidence status as an official score. Disable the
relevant flag first, then investigate from minimized diagnostics.

## External release checklist

Repository implementation cannot perform deployment or moderated user research.
The release owner must record:

- deployment/environment and commit SHA;
- cohort allocation and start/end time;
- five usability-session notes;
- dashboard links and alert owners;
- AI eval report path and model identifiers;
- decision: expand, adjust, or stop.
