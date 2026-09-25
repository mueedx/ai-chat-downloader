# Data Model: Chat Export Core

## Turn

One message in a conversation.

| Field | Type | Notes |
| --- | --- | --- |
| `role` | `'user' \| 'assistant'` | Who sent it. Normalised at the adapter boundary. |
| `text` | `string` | Full message text, code blocks already fenced. Empty only when notes exist. |
| `notes` | `string[]` | Labelled placeholders for non-text content, e.g. `image`, `attachment`. |
| `incomplete` | `boolean` | True when the reply was still streaming when extraction ran. |

A turn with no `text` and no `notes` is a bug, not a valid turn. `normaliseTurn` drops it and
the count surfaces as `unreadableTurns`.

## Chat

The normalised conversation. Every renderer reads this and nothing else.

| Field | Type | Notes |
| --- | --- | --- |
| `site` | `string` | Adapter id, e.g. `chatgpt`. |
| `siteLabel` | `string` | Human name, e.g. `ChatGPT`. |
| `title` | `string` | Conversation title, or `''` when the site exposes none. |
| `url` | `string` | The page the conversation was read from. |
| `exportedAt` | `string` | ISO 8601 local timestamp of the export. |
| `turns` | `Turn[]` | In page order. Never reordered, never deduplicated. |
| `unreadableTurns` | `number` | Containers found but not readable. Reported, never silently dropped (FR-012). |
| `incompleteTurns` | `number` | Turns still streaming at export time (FR-013). |
| `partial` | `boolean` | True when the page had not rendered the whole conversation (FR-014). |
| `selection` | `null \| {from, to}` | 1-based inclusive turn range when the user exported a subset (FR-022, FR-023). |

## Section

The single intermediate shape all four renderers consume. Defined once in
`src/exporters/sections.js` so no renderer can invent its own idea of a heading.

| Field | Type | Notes |
| --- | --- | --- |
| `kind` | `'title' \| 'meta' \| 'heading' \| 'body' \| 'note'` | Drives styling in every format. |
| `heading` | `string \| null` | `You` or `Assistant`, plus the site label on the assistant heading. |
| `text` | `string` | Already escaped or fenced as the target format requires. |

## ExtractResult

What an adapter returns. Never throws for the normal failure cases.

| Field | Type | Notes |
| --- | --- | --- |
| `ok` | `boolean` | False means no file may be written (FR-011). |
| `chat` | `Chat \| null` | Null when `ok` is false. |
| `reason` | `string \| null` | Specific failure text shown to the user. |
| `tried` | `string[]` | Selectors attempted, shown when nothing matched. |

## Export

| Field | Type | Notes |
| --- | --- | --- |
| `format` | `'md' \| 'txt' \| 'docx' \| 'pdf'` | Exactly four, per FR-003. |
| `extension` | `string` | `md`, `txt`, `docx`, `pdf`. |
| `mime` | `string` | Sent to the download. |
| `filename` | `string` | Title slug plus timestamp (FR-016). |
| `bytes` | `Uint8Array` | Always bytes, including for text formats, so one write path serves all. |

## Settings

`chrome.storage.local`, never `sync`, because a transcript is never stored and preferences
should not leave the profile.

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `format` | `'md' \| 'txt' \| 'docx' \| 'pdf'` | `'md'` | Last used format (FR-024). |
| `disabledSites` | `string[]` | `[]` | Per-site opt-out, so a user can mute one site (FR-021). |
