# Label-driven releases

| PR label | Behavior |
| --- | --- |
| None | Patch bump in the next master release |
| `release:minor` | Minor bump in the next master release |
| `release:major` | Major bump in the next master release |
| `release:hotfix` | Isolated patch release from an existing stable tag |

Use at most one of these release labels per PR. Other labels are unaffected. If several ordinary PRs are included in a release, the largest requested bump wins. PR titles become changelog entries. Labels on merged PRs can be edited to recalculate an open release proposal; manual dispatch also refreshes it.

## Ordinary releases

Create feature PRs targeting master without changing the version or changelog. After a merge, Prepare release PR regenerates the bot-owned automation/release branch from current master. It updates package.json, package-lock.json and CHANGELOG.md together and creates or updates one release PR targeting master.

Review and test that PR, then merge it. Tag version changes checks every first-parent version transition in the master push and creates the matching v-prefixed tag. Existing tags on the same commit are skipped; a tag on another commit causes a visible failure and is never moved. App-created tags trigger the existing Build/Publish workflow. The listener refuses to publish a PR labeled release:hotfix if it was incorrectly merged into master.

The release baseline is master's latest version-changing commit. A maintenance hotfix tag does not move that baseline or consume its pending feature changes. Proposed versions skip existing tags and versions reserved by prepared hotfix PRs, so a pending patch release advances from 3.1.1 to 3.1.2 when a maintenance hotfix uses 3.1.1.

Automation owns its release branch and refuses to overwrite manually edited commits. Edit source PR titles or labels and rerun preparation instead. A direct version bump on master remains a full release of everything on master; it is not an isolated hotfix.

## Isolated hotfixes

Example: v3.1.0 has a bug while master contains features waiting for release.

1. Create a fix branch from the v3.1.0 tag. Start from the latest released patch on the affected major/minor line, rather than current master.
2. Push the fix and open a PR initially targeting master. Leave its version unchanged and apply release:hotfix. Mark drafts ready for review when the fix is ready.
3. Automation infers v3.1.0 from package.json and validates that the branch descends from that tag without incorporating later master commits. It creates maintenance/3.1 if necessary and retargets the same PR there.
4. A bot commit on the author's fix branch sets version 3.1.1 in package.json and package-lock.json and prepends a changelog entry using the PR title. Existing code commits and contributor attribution are preserved. The PR description gets a Hotfix base: v3.1.0 field for retries; keep that field and the hotfix label.
5. Review the generated metadata, fix, and successful Hotfix build. Merge the PR into maintenance/3.1.
6. The default-branch hotfix workflow tags the maintenance merge commit as v3.1.1, triggering publication without including pending master features.
7. Automation opens a separate bot-owned backport PR targeting master and refreshes the pending release proposal. Review and merge the backport to bring the fix into master; its merge refreshes the existing release PR again with the fix included.

You can explicitly supply a line such as `Hotfix base: v3.1.0` in the PR description if the version was already manually bumped. Normally the inferred baseline requires no extra input. Only stable version tags are supported for hotfixes.

The backport retains the maintenance fix and its original commit history. A bot commit restores release metadata relative to the affected tag so a normal three-way merge preserves master's current version and changelog. Dependency changes in the fix are retained. Conflicts require review and resolution; the bot never automatically merges the backport. Do not label that PR release:hotfix.

Finish one hotfix on each maintenance line before preparing another. A maintenance branch that advanced to another version, contains unrelated unreleased edits, or has different CI is rejected. Branch from its latest release tag for the next hotfix. Hotfix PRs cannot modify workflow files; make automation changes through an ordinary PR. Cross-repository fork branches and comparisons of 300 or more changed files are not supported by hotfix preparation.

Historical release tags may lack the new test workflow. When creating the maintenance branch, the bot adds only the trusted hotfix-build.yml workflow from master, preserving its package version. This CI-only bootstrap does not bring master feature code into the maintenance release. Hotfix tests use the normal pull_request event with a read-only token; the privileged routing job only runs trusted master automation and reads hotfix contents through the API.

## Setup and checks

The App is 5245338 (snekcode-agent), scoped to SnekCode/WheelOfNamesHelper. Runtime needs Contents and Pull requests write permissions; isolated hotfix preparation also needs Workflows write to install maintenance CI. Store a separate App key in the RELEASE_APP_PRIVATE_KEY repository Actions secret. The existing local private-key.pem stays local and is not uploaded by this proposal. The secret has been provisioned by the repository owner.

Installation tokens are restricted to this repository and the job's requested permissions, then revoked at job completion. Ordinary release preparation requests Contents and Pull requests write; master tagging requests only Contents write. Hotfix preparation requests those permissions plus Workflows write. No job executes hotfix code while holding this App token.

Keep review and test requirements in branch protection, including for maintenance/* branches. For hotfixes, require the hotfix preparation job and Hotfix build / build before merging. This proposal does not change protection rules or merge PRs automatically. Avoid the legacy version-bump.js script because it can delete published tags.

Preparation reads latest master to reconcile events coalesced by concurrency. Hotfix handling is serialized per PR and reconciles its current state; existing tags and backport PRs are reused on retries. On failure, inspect the run and rerun it. An interrupted master tag run can be retried on its original push; manual dispatch checks only the latest master commit. Existing published tags are never moved.

Run automation tests with `node --test .github/scripts/release.test.cjs .github/scripts/hotfix.test.cjs`. They use temporary Git histories and mocked GitHub APIs; they do not create real branches, PRs, tags or releases.
