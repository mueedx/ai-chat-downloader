# Supported sites

Six sites, six independent adapters. This page is the honest status board: what each adapter
matches on, how it decides which side wrote a message, and whether anyone has checked it against
a live signed-in conversation.

**No site is verified yet.** The fixtures in `test/fixtures/` prove the extraction engine and the
adapter contract. They do not prove that a live site still uses the same markup, because nobody
has run an export against a signed-in account. Until the `Last verified` column has a date, treat
every export as a first check and report a break with the popup's selector list.

| Site | Origins | Role source | Last verified | Verified |
| --- | --- | --- | --- | --- |
| ChatGPT | `chatgpt.com`, `chat.openai.com` | `data-message-author-role` attribute | none | no |
| Claude | `claude.ai` | `data-testid` value (`user-message`, `assistant-message`) | none | no |
| Gemini | `gemini.google.com` | custom element name (`user-query`, `model-response`) | none | no |
| DeepSeek | `chat.deepseek.com` | reviewed fallback: a `.ds-markdown` block means the assistant | none | no |
| Qwen | `chat.qwen.ai`, `tongyi.aliyun.com` | `data-author` attribute, then a reviewed fallback | none | no |
| Kimi | `kimi.com`, `www.kimi.com`, `kimi.moonshot.cn` | reviewed fallback: a `.markdown` block means the assistant | none | no |

## How a role is decided

In order, and never any further:

1. A role attribute listed in the adapter, mapped through the shared alias table in
   `src/core/chat.js`. `user`, `human`, `prompt` become `user`; `assistant`, `model`, `ai`,
   `bot` become `assistant`.
2. A custom element name listed in the adapter's `tagRoles`.
3. The adapter's own `roleFallback` function, which returns a role string.

If none of those resolve, the container is counted as unreadable and reported. It is never
guessed from a styling class on its own.

DeepSeek, Qwen, and Kimi fall back to step 3 because they do not expose a role attribute. Each
fallback is a reviewed heuristic, recorded here, and each is the first thing to check when one of
those sites breaks.

## What each site does not give us

- **Gemini** has no confirmed streaming indicator, so a reply that is still being written is
  exported as read rather than marked incomplete.
- **DeepSeek, Qwen, Kimi** use generated class names that change without notice. Both their
  selectors and their fallbacks are heuristics.
- **Every site** virtualises very long transcripts, so only the rendered part can be captured.
  The popup says so when it detects a scrolled transcript.

## How complete a capture is

Every exported file states whether it is the whole conversation. The claim comes from one place, the
walk in `src/core/walker.js`, and it has two outcomes rather than three: either the walk reached the
bottom of the transcript container, or the file says what part of it holds and why.

What each site needs for that to work is a scroll container its adapter declares, and how that
container behaves:

| Site | Scroll container | Virtualises older turns | Notes |
| --- | --- | --- | --- |
| ChatGPT | `main` | expected on long chats | unverified |
| Claude | `main` | expected on long chats | unverified |
| Gemini | `main` | unknown | no streaming selector either, see above |
| DeepSeek | `main` | unknown | unverified |
| Qwen | `main` | unknown | unverified |
| Kimi | `main` | unknown | unverified |

Everything in that table is unverified, like the selectors above it. The walk is written to work
through the container every adapter already declares, so it is site-agnostic, but that has not been
confirmed against a real long conversation on any of them. Until it is, a site marked unverified
should be assumed to produce an incomplete capture on a long conversation, and the file will say so.

Two limits are structural rather than per-site. A site that needs a "load more" control is not
walked at all, because the extension does not click page controls. And a site that recycles its
message elements needs the successive reads merged, which the walk does, but the merge is a
heuristic on overlap and has only been tested against the shapes a recycling list produces.

When the walk is switched off, or cannot run, the file says the capture covers only what the page
had rendered. The previous behaviour, a shared partial note based on scroll position, is gone: a
capture is complete when the walk says so, and incomplete otherwise, and the reason is specific.

## Recording a verification

When you check a site against a live conversation:

1. Set `verified: true` and `lastVerified: 'YYYY-MM-DD'` in the adapter.
2. Put the date in the table above.
3. Note in the commit message which conversation shape you saw, sanitised, and which selectors
   still matched.
4. If the selectors needed changing, change the fixture in the same commit.

That is the whole process. It exists so the next person can tell the difference between "this
worked once" and "this has never been checked".
