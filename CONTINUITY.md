- Address user feedback by reducing AsyncStorage use for secrets (tokens) and keep Keychain-only storage; commit changes and create PR.
=======
- Address latest user feedback on Keychain passphrase storage; commit changes and create PR.


Constraints/Assumptions:
- Must update this ledger each turn and after material changes.
- Commit changes and call make_pr only when changes exist.

Key decisions:
- UNCONFIRMED: no inline diff comments were provided; need to infer improvement.

State: