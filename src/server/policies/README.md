# policies

Role → permission map and the `can(user, permission)` helper (Phase 1). Every mutation checks
a policy before calling a service. The roles × modules matrix is in
`docs/prompts/system-rebuild.md` → `<roles_and_modules>`.
