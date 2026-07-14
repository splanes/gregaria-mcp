# Contributing

## Local setup

```bash
cp .env.example .env.local
# passthrough mode (default): barely anything to fill in, see .env.example.
# proxy mode: fill in INTERVALS_CLIENT_ID/SECRET, INTERVALS_OAUTH_*, RELAY_SEAL_KEY.
npm install
npm run dev
```

## Workflow

1. **Open an issue first.** Describe the bug or the feature before writing any code — this avoids
   duplicated or wasted work, and gives us a chance to align on approach.
2. Once there's agreement on the issue, open a PR that references it (`Closes #N` in the
   description).
3. Keep PRs focused: one issue, one PR. Unrelated cleanup goes in its own issue/PR.

PRs that don't reference an issue may be asked to open one before review continues.
