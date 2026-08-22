# Kronox Online Modes

Status: Active product contract.

Online Kapış and Duello share only the backend-owned matchmaking lane
infrastructure. Both use bounded search, same-screen match-found feedback, and
direct game navigation without `/lobby`.

Online Kapış remains the existing turn-based `/game` mode with its unchanged
backend winner +15 / loser -6 scoring. It does not read Solo category
preferences.

Duello uses the separate `same_question_duel` lane and `/duel` route. Duello V2
is simultaneous: both players receive the same question, shared timeline,
question index, and 10-second server deadline. Its shared timeline grows after
every resolved round, and it uses the +50 / +25 / 0 rules defined in
`docs/KRONOX_DUELLO.md`. Duello state and scoring must never leak into Online
Kapış.
