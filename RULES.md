# RULES

These are the writing and reporting rules for this repository. They are binding on any agent
or human producing prose here: README, docs, specs, changelog entries, issue text, pull
request descriptions, store listings, and social posts derived from this project.

## AI-slop avoidance checklist

Run every draft through this before delivering it.

### Banned words and phrases (hard block)

delve, tapestry, beacon, testament to, realm, paradigm, cornerstone, furthermore, moreover, in
conclusion, it is important to note, unlock, game-changer, in today's fast-paced world, navigate
the landscape, unleash, dive deep, at the end of the day, holistic, synergy

### Banned structural patterns

- "Not only X, but also Y" is never used.
- No constructed list-triplets in prose. Three short parallel sentences starting the same way
  for rhythm are a list pretending to be prose. Cut two of the three and keep the strongest, or
  convert to a real bulleted list.
- No disguised summary lines. A short declarative sentence placed after a story beat whose only
  job is to tell the reader how to feel about what they just read is cut. If a sentence adds no
  new information, it goes.
- No bold headers or numbered section breaks in posts. Posts have zero markdown-style
  formatting.
- No generic closing question. "Thoughts?", "What do you think?", and "Curious to hear your
  take" are banned.
- No windup openers. "In today's AI landscape,", "As we move into an era of,", and "It's no
  secret that." are cut. Start at the claim.
- Em-dashes are used sparingly, at most one per post.
- No quotation marks for emphasis. Do not wrap a word in quotes to add weight to it.

### Fact and attribution precision

- Never blend two different incidents or sources into one description, even when they are
  thematically similar. Each detail stays attributed to its actual source.
- An important caveat in the source survives into the post. "Under loosened test conditions,
  not default behaviour" does not become "the model does this".
- When several actors, companies, or models are involved, name which one did what. No vague
  collective terms such as "the agents" or "an AI" where the source distinguishes them.
- Verify any statistic or claim by search before using it. Never invent or half-remember a
  number.

### Delivery hygiene

- No meta-commentary inside the draft. "Here's the post following your structure" is not part
  of the post. Deliver the post text only, and put notes separately afterwards.
- Target 300 to 400 words unless told otherwise.
- A real blank line between every single-line paragraph, because LinkedIn collapses single line
  breaks.

## Engineering rules

These come from `.specify/memory/constitution.md` and are not optional either.

1. Spec Kit order: constitution, then specify, then plan, then tasks, then implement. No code
   before a spec exists for it.
2. `spec.md` stays technology-agnostic. Stack and file paths belong in `plan.md` and
   `tasks.md`.
3. No runtime dependency. `src/` is exactly what Chrome loads. No bundler, no transpiler, no
   `eval`, no `new Function`, no remote code, and no Node globals such as `Buffer`.
3a. Three scopes, three rules. Content scripts and extension pages have a `window`; the service
   worker does not, and it is loaded on its own. Never write a test that supplies a global the real
   scope lacks, because that hides the bug instead of finding it.
4. Permissions are `storage` and `downloads` only. Host access is the explicit origin list, never
   a wildcard. Changing either requires a constitution amendment.
5. No network request leaves the extension. Conversation content, titles, counts, filenames, and
   usage statistics stay on the user's machine.
6. Extraction is honest. Zero readable turns is a failure that writes no file. Unreadable turns,
   incomplete turns, and partial captures are reported, never hidden.
7. `npm test` is green before a commit. `npm run check:manifest` passes too.
8. Every manifest origin appears in `docs/supported-sites.md` with a last-verified date.

## Reporting

Whenever a feature is delivered, a task the user asked for is finished, or a non-trivial change
lands, update the reports in the same turn as the delivery.

1. Daily report: `report/YYYY-MM-DD.md` using the current local date. Create it if missing,
   append a new section if it already exists, never overwrite an earlier section.
2. Change log: `report/changes.md`. Append bullets under today's `## YYYY-MM-DD` heading, and
   add that heading at the top of the log if it is new.

Skip the reports only for pure Q&A, copy the user will paste elsewhere, or a one-line fix with
no behaviour change. When unsure, write the report.

## Commit hygiene

- One logical change per commit. Conventional Commit prefixes: `feat`, `fix`, `docs`, `test`,
   `chore`, `refactor`.
- A commit that changes a site's selectors also updates that site's row in
  `docs/supported-sites.md` and its fixture in `test/fixtures/`.
- Never commit a transcript, a cookie, a token, or a screenshot of a private conversation.
