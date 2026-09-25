# Security Policy

## Supported versions

Only the latest published version is supported. Fixes land on the next patch release.

| Version | Supported |
| --- | --- |
| 0.1.x | yes |

## Reporting a vulnerability

Email the maintainer rather than opening a public issue. Use the address in the repository's
GitHub profile, or open a private security advisory on the repository.

Include the version, the Chrome version, what an attacker gains, and the steps to reproduce. You
can expect an acknowledgement within three days and a fix or a mitigation plan within two weeks.

Please do not test against other people's conversations. Use a throwaway account with text you
wrote yourself.

## What this extension does not do, by design

- It makes no network request. There is no server, no analytics, and no error reporting.
- It stores no conversation. `chrome.storage.local` holds only your format preference and your
  per-site switches.
- It requests `storage` and `downloads` plus the explicit origins of the six supported chat
  sites. No wildcard, no `<all_urls>`.
- It loads no remote code, which Manifest V3 forbids anyway.

## Reading a private conversation

The extension reads the page you have open, with your own session, because that is the only way
to export a conversation you are allowed to read. It does not fetch the site itself, does not
replay your session, and does not attempt to work around access controls. If you can see the
conversation, the extension can export it; if you cannot, neither can it.
