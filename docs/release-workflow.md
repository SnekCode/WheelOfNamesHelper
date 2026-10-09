# Release workflow

Feature PRs target master without version or changelog edits. After a merge, Prepare release PR regenerates automation/release from current master, updates package.json and package-lock.json, and prepends a changelog section. One release PR targets master and collects all changes since its latest version bump.

Patch is the default. Apply release:minor or release:major to source PRs for a larger bump; the largest wins. PR titles become changelog bullets. Direct commits are included by their subjects. Rerun preparation after editing titles or labels. Automation owns the release branch and refuses to overwrite manual commits.

Review and test the release PR before merging. Tag version changes compares package.json across master commits. It creates v-prefixed tags only for changed versions, skips an existing tag on the same commit, and fails for a tag on another commit. Multi-commit pushes are checked commit by commit. Manual dispatch retries the latest master commit.

A hotfix PR can update package.json, package-lock.json and CHANGELOG.md directly. Its merge is tagged without a release PR. Preparation uses the latest version-changing commit as the baseline, even before tagging finishes. Pending proposals refresh against the new version; obsolete release PRs close when there are no remaining changes. A release PR merge does not start another release.

## Setup

The App is 5245338 (snekcode-agent), restricted to SnekCode/WheelOfNamesHelper. Runtime needs Contents and Pull requests write permissions. Submitting workflow files additionally requires Workflows write permission. Permission changes require explicit owner authorization.

Before enabling the workflows, the repository owner must separately provision RELEASE_APP_PRIVATE_KEY as an Actions secret using a dedicated new key for this App. Never copy or upload the existing local private-key.pem. No credentials are included in this proposal. Provisioning a key is a separate administrative task.

Installation tokens are restricted to this repository and each job's minimum permissions, and revoked by create-github-app-token at job completion. App tokens allow generated PRs to trigger Build and tags to trigger the existing Build/Publish workflow. Listeners only run trusted master code.

This replaces the manual release workflow that directly pushes version bumps to master. Avoid the legacy version-bump.js script, which can delete published tags. Branch protection remains responsible for tests and review. This proposal does not configure secrets, change permissions or protection rules, or publish a release.

Preparation reads latest master to reconcile merges coalesced by concurrency. An interrupted tag run can be retried on its original push; manual dispatch checks only the latest commit. Existing published tags are never moved.
