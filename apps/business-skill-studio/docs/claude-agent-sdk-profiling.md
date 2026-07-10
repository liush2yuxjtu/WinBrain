# Claude Agent SDK timing profiles

Business Skill Studio can emit structured timing profiles for every Claude Agent SDK request. The profiler covers chat, Skill drafting, and database-prompt calls, including credential failover.

## Enable profiling

Set `AGENT_SDK_PROFILE_LOGGING` in the server environment:

| Value | Behavior |
| --- | --- |
| `off` | No profiling output. |
| `summary` | Emits one summary for each credential attempt and one end-to-end trace summary. |
| `verbose` | Emits summaries plus trace, attempt, and first-occurrence milestone events. |

Aliases such as `true`, `1`, and `enabled` select `summary`; `debug` selects `verbose`; `false`, `0`, and `disabled` select `off`.

When the variable is omitted, `NODE_ENV=development` defaults to `summary`. Production and test environments default to `off`, so profiling remains opt-in outside local development.

```bash
AGENT_SDK_PROFILE_LOGGING=summary npm run dev
```

Each line starts with `[claude-agent-sdk-profile]` followed by a JSON object. This keeps the records easy to grep while allowing log processors to parse the structured payload.

## Correlation model

Every record contains:

- `schemaVersion`: profile schema version;
- `traceId`: one UUID shared by all events from a logical request;
- `operation`: `chat`, `skill-draft`, or `database-prompt`;
- `event`: the profile event type;
- `timestamp`: wall-clock timestamp for log correlation.

Credential attempts also include `attempt` and `credentialSlot`. A request that fails on `primary` and succeeds on `fallback` therefore produces two correlated attempt summaries and one trace summary.

## Attempt metrics

`attempt.summary` reports adapter-observed timing using a monotonic clock:

- `durationMs`: complete attempt duration, including cleanup;
- `querySetupMs`: time spent creating the SDK query and iterator;
- `timeToFirstMessageMs`: time until the first SDK message;
- `timeToInitMs`: time until the SDK `system/init` message;
- `timeToFirstTextMs`: time until the first normal text is available;
- `timeToFirstAssistantMs`: time until the first `assistant` message;
- `timeToResultMs`: time until the SDK `result` message;
- `cleanupMs`: time spent aborting and closing the SDK handle;
- `messageCount` and `messageTypes`: message volume by SDK type/subtype;
- `textDeltaCount` and `emittedTextChars`: streamed output activity;
- `heartbeatCount`: number of 15-second waiting heartbeats;
- `outputChars`: final accumulated output size;
- `sdkDurationMs`, `sdkApiDurationMs`, and `sdkNumTurns`: SDK-reported result metrics when supplied by the installed SDK version;
- `outcome`, `errorName`, and `errorKind`: safe completion classification without error-message contents.

In `verbose` mode, `attempt.milestone` events expose the first occurrence of query readiness, SDK initialization, first message, first text, first assistant message, and final result.

## Trace metrics

`trace.summary` describes the complete logical request across all credential attempts:

- `durationMs`: end-to-end adapter duration;
- `attemptDurationMs`: sum of completed credential-attempt durations;
- `overheadMs`: time outside attempts, including failover orchestration and downstream stream consumption;
- `candidateCount` and `attemptCount`;
- `failoverCount`;
- `credentialSlot` selected on success;
- `outcome`: `success`, `fallback`, `error`, or `cancelled`;
- `fallbackReason`: `credentials_unconfigured` or `all_attempts_failed` when applicable;
- prompt, system-prompt, and output character counts;
- the ordered attempt summaries for single-record inspection.

## Data-safety boundary

The profiler does **not** write any of the following to logs:

- prompt or system-prompt contents;
- model response contents;
- credential values;
- raw SDK error messages;
- thinking or reasoning text.

Only character counts, timing values, SDK message classifications, credential slot names, and normalized error categories are recorded. Existing application status messages and warnings retain their current behavior and are separate from the profiling output.

## Reading a profile

For latency investigation, start with `trace.summary`, then filter by its `traceId`:

1. Compare `durationMs` with `attemptDurationMs` to identify adapter or consumer overhead.
2. Compare `querySetupMs`, `timeToInitMs`, and `timeToFirstTextMs` to separate startup latency from model-generation latency.
3. Compare `timeToResultMs` with `sdkApiDurationMs` when the SDK reports both values.
4. Inspect multiple attempts and `failoverCount` to quantify credential failover cost.
5. Use `heartbeatCount` to identify requests that spent extended periods waiting for the next SDK message.
