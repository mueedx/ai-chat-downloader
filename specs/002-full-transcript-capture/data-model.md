# Data Model: Full Transcript Capture

## WalkResult

What one attempt did. Produced by the walker, never thrown.

| Field | Type | Notes |
| --- | --- | --- |
| `ran` | `boolean` | False when skipped, for example on a background tab. |
| `skippedReason` | `string \| null` | Why it did not run, in the user's terms. |
| `completed` | `boolean` | True when the walk reached the bottom without hitting a bound. |
| `stopReason` | `string \| null` | `bottom`, `time-limit`, `step-limit`, `cancelled`, `no-container`, `not-scrollable`. |
| `steps` | `number` | Positions visited, for the progress line and for bug reports. |
| `durationMs` | `number` | FR-020. |
| `restored` | `boolean` | The reading position was put back. |
| `grew` | `number` | How much the container grew during the top phase, in pixels. |
| `turns` | `Turn[]` | Everything seen, merged. Empty when the final read wins. |

## Completeness

What the file is allowed to claim. There is no third state, by design.

| Field | Type | Notes |
| --- | --- | --- |
| `state` | `'complete' \| 'rendered' \| 'walked'` | `walked` is used when the walk ran and completed. `rendered` means only the on-screen part is present. |
| `reason` | `string \| null` | Present whenever `state` is not `complete`. |
| `from` | `number \| null` | 1-based index of the first captured turn, when the capture is a known window. |
| `to` | `number \| null` | 1-based index of the last captured turn. |

`complete` is only ever produced by a walk that reached the bottom with no bound hit, or by a page
that is not scrollable at all. Nothing infers completeness from turn count.

## Chat, extended

```js
{
  ...existing fields...,
  completeness: Completeness,
  walk: { steps, durationMs, stopReason } | null
}
```

`partial` stays, derived from `completeness.state !== 'complete'`, so nothing else that reads
`partial` changes meaning.

## Settings, extended

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `walkEnabled` | `boolean` | `true` | The global switch, FR-010. |
| `walkDisabledSites` | `string[]` | `[]` | Per-site opt-out, FR-010. |

## Capture, the walker callback

The walker takes a function and calls it once per step, receiving the turns currently rendered. The
callback is the existing extraction path, unchanged, which is what keeps FR-017 true: the walker
learns nothing about selectors.
