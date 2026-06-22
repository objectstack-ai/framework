#!/usr/bin/env bash
# release-publish.sh — npm publish + atomic git-tag push for the Release workflow.
#
# Why this exists (the bug it fixes):
#   `changeset publish` publishes every package to npm and creates a local
#   annotated git tag (`<pkg>@<version>`) for each one. changesets/action
#   then pushes those tags — but it fires one `git push origin <tag>` per tag
#   *concurrently* (Promise.all). With this monorepo's large Changesets "fixed"
#   group (~70+ packages all bumping in lockstep), that burst of simultaneous
#   ref-creation pushes races on GitHub's ref backend, which responds with
#   `remote: fatal error in commit_refs` and rejects a chunk of the tags. npm
#   publishing has already fully succeeded by then, yet the job fails and the
#   rejected version tags never make it to the remote (#2191).
#
# The fix:
#   Push ALL new tags ourselves in a SINGLE atomic `git push origin --tags`
#   immediately after `changeset publish`. One push = one ref transaction, so
#   there is no concurrency to race. By the time changesets/action runs its own
#   per-tag pushes, every tag already exists on the remote at the same SHA, so
#   each of those pushes is a harmless no-op ("Everything up-to-date").
#
#   git push auth comes from the persisted actions/checkout credentials. The
#   tags themselves are already created by `changeset publish` (which configures
#   the CI git identity); this script only pushes them. Run as the `publish:`
#   command of changesets/action (see
#   .github/workflows/release.yml) so the atomic push happens before the action
#   pushes tags itself.
set -euo pipefail

# Publish to npm and create the local version tags.
changeset publish

# Push every new tag in one atomic transaction (see header). --tags pushes ALL
# local tags regardless of reachability; --follow-tags would push nothing here
# since this is a bare push with no branch ref attached.
git push origin --tags
