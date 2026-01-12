Goal (incl. success criteria):
- Address user feedback by reducing AsyncStorage use for secrets (tokens) and keep Keychain-only storage; commit changes and create PR.

Constraints/Assumptions:
- Must update this ledger each turn and after material changes.
- Commit changes and call make_pr only when changes exist.

Key decisions:
- UNCONFIRMED: no inline diff comments were provided; need to infer improvement.

State:
- Done: token storage now prioritizes Keychain with legacy AsyncStorage migration and cleanup.
- Now: prepare commit and PR.
- Next: report summary/testing.

Open questions (UNCONFIRMED if needed):
- UNCONFIRMED: What specific inline comment or issue drove dissatisfaction?

Working set (files/ids/commands):
- CONTINUITY.md
- src/storage/authTokenStorage.ts
