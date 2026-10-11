# Agent instructions

## Delivery workflow

When delivering a requested code change:

1. Work from `develop`.
2. Stage only the files belonging to the requested change; preserve unrelated worktree edits.
3. Commit on `develop` with a focused conventional-commit message.
4. Push `develop` to `origin/develop`.
5. Switch to `main` and run `git merge --ff-only develop`.
6. Push `main` to `origin/main`.
7. Verify that `develop`, `main`, `origin/develop`, and `origin/main` point to the intended commit. State explicitly whether a PR or merge commit exists.

Keep `main` as the post-delivery checkout, and do not rewrite or discard unrelated user changes.
