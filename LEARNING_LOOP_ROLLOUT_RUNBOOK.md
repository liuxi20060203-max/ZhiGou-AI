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

## Phase 5 checkpoint (2026-09-22)

- Local regression passed: 14 learning-loop/classroom test files, 47 tests. This includes the compact knowledge-path details entry.
- The user confirmed local acceptance on 2026-09-22 after the supplied walkthrough covering the knowledge path, details/repair flow, verification result, completion report, and refresh persistence. Specific viewport sizes were not recorded; this is one acceptance confirmation, not five moderated sessions.
- The repair eval suite contains 20 scenarios, but the real-model run is pending: `EVAL_REPAIR_MODEL` (or `DEFAULT_MODEL`) and `EVAL_JUDGE_MODEL` are not configured in the current local environment. Do not count a template-only run as the AI gate.
- The five moderated usability sessions, real-classroom viewport review, deployment analytics/alerts, and 10% cohort results have not been recorded. Do not infer these outcomes from automated tests.
- Phase 6 remains gated until the Phase 5 release owner records actual results and makes an expand/adjust/stop decision.

### Next acceptance actions

1. Configure explicit generator and judge models in the evaluation environment, then run `pnpm eval:learning-loop-repair`. Keep model identifiers and the generated report path with the release record; all 20 cases must pass the rubric in this runbook.
2. Run five first-use sessions on a real course. Ask each participant to find a component's objective/evidence, explain what “已有验证” means, identify a weak point, complete a repair path, and return to the course. Record whether they find “详情” unaided within 10 seconds and whether any Scene, Quiz draft, Interactive, or playback state is lost.
3. Review the same course at 1440×900, 1280×720, and 390×844 with both side panels open/closed. Confirm the details dialog, repair panel, task entry, and completion report remain readable and operable.
4. Attach an analytics adapter and alert owners, enable the internal cohort, then make a separate decision before 10% rollout. Record denominator definitions, baseline timings, fallback/schema rates, and rollback owner.
