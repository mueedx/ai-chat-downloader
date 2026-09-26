# Live verification checklist

One adapter at a time, on a throwaway conversation you wrote yourself. This is the procedure
that turns a site from `verified: false` to a dated claim, and it is deliberately boring so two
people do it the same way.

## Before you start

Use a conversation you created from scratch. Do not verify against a real conversation, a client
thread, or anything containing someone else's words. If a check fails, the evidence you paste into
an issue must be sanitised, and the fixture you commit must contain text you wrote.

Record the Chrome version and the extension version with the result. A site that works in one
version and not another is still a break.

## Per site

1. Create a new conversation with a single, harmless exchange. Something like "reply with the word
   banana". No personal data, no code from a real project.
2. Confirm the popup shows the site name, a non-zero message count, and the word banana. If the
   count is zero, stop: the selector has broken and this is a repair, not a verification.
3. Add a second turn, then a third. Confirm the order matches the page and that no turn is
   missing from the middle.
4. Ask for a code block with deliberate indentation and a blank line inside it:

   ```python
   def f():
       x = 1

       return x
   ```

   Confirm the exported file keeps the indentation and the blank line.
5. Attach an image to your own message. Confirm the export shows a note such as `[image]` and no
   invented caption or link.
6. Send a message and export while the reply is still streaming. Confirm the export either excludes
   the partial turn or marks it as incomplete, and never presents it as finished.
7. Start a long conversation, scroll to the middle, and export. Confirm the popup warns that only
   the rendered part was captured.
8. Rename the conversation to something with punctuation, emoji, and a non-Latin script. Confirm the
   file saves with a valid name on your operating system.
9. Export the same conversation to all four formats and open each one. DOCX must open in your word
   processor with no repair prompt, and PDF must open in a viewer.
10. Export a CJK conversation to PDF and confirm the popup warns about the characters it cannot
    draw, and that Markdown, text, and Word keep the text.

## What to record

For the site you just checked:

- [ ] The date, in `YYYY-MM-DD`, in the `Last verified` column of
      [`supported-sites.md`](supported-sites.md).
- [ ] `verified: true` and `lastVerified: '<date>'` in `src/adapters/<site>.js`.
- [ ] The Chrome version and the extension version, in the commit message.
- [ ] Whether every step above passed. A site with one failing step stays `verified: false`, and the
      failing step becomes the adapter's `knownIssues`.
- [ ] If any selector changed, the fixture in `test/fixtures/<site>.html` changes in the same
      commit, and `npm test` passes.

## If it breaks

A break is a new spec under `specs/`, not a quiet patch. The spec records which site changed, what
the old selector matched, what the page now renders, and whether the role signal still exists. The
repair then touches one adapter file and one fixture. No renderer changes, and no other adapter
changes, because that isolation is the reason a break is a small job.

Report the failure with the popup's own message, which already lists the selectors that were
tried, plus a sanitised snippet of one message container.
