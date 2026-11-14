# Agent guide

## Application

Streamer Wheel Of Names Helper is an Electron desktop application for managing viewer participation in a wheel of names. Streamers can collect entries from Twitch and YouTube chat, manage weighted chances, search or manually add viewers, and interact with an embedded Wheel of Names window. Viewer entries and settings persist across sessions.

Discord integration adds voice-channel participation and winner movement. The application also includes OAuth authentication, settings, release notes, and automatic updates. Treat viewer data, authentication state, and existing user settings as data that must survive upgrades.

The UI uses Vue 3 and TypeScript with Vite. Electron supplies the desktop main process and preload bridges; electron-builder produces installers. Windows is the application build target exercised by the current CI. Packaging configuration also defines macOS and Linux targets, but a successful Windows build does not verify those platforms.

## Repository map

| Location | Responsibility |
| --- | --- |
| `src/App.vue`, `src/components/`, `src/pages/` | Renderer UI, viewer controls, settings, Discord page, update UI |
| `src/router/`, `src/main.ts` | Renderer routing and application startup |
| `electron/main/main.ts` | Electron startup, windows, integration setup and IPC handlers |
| `electron/main/wheelOfNames.ts` | Embedded Wheel of Names window |
| `electron/preload/` | Context bridges and interaction with the embedded wheel |
| `electron/data/`, `electron/main/store.ts`, `electron/migration/` | Viewer data, persisted settings and migration logic |
| `electron/ChatService/`, `electron/Twitch/`, `electron/YouTube/` | Shared chat behavior and platform authentication/chat integrations |
| `electron/Discord/` | Discord authentication, server/channel state and voice behavior |
| `electron/updater/` | Application updates and release notes |
| `Shared/` | Types, enums, store contracts and IPC channel definitions shared across processes |
| `.github/scripts/`, `.github/workflows/` | Release automation, tests, application builds and deployment |
| `docs/release-workflow.md` | Detailed release, hotfix and retry procedures |
| `homepage/` | Static homepage; its deployment is separate from desktop releases |

Respect directory capitalization, particularly `Shared/`; Linux CI is case-sensitive.

## Development and verification

Run commands from the repository root. Use npm and the committed package-lock.json. Match the Node version in the workflow relevant to the change; the application build and release automation jobs can use different versions. Native dependencies such as keytar and Electron may require a compatible platform/toolchain.

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the locked dependency set |
| `npm run dev` | Run the development application |
| `npm test` | Run application tests using Jest and ts-jest |
| `node --test .github/scripts/release.test.cjs .github/scripts/hotfix.test.cjs` | Test release automation with temporary Git histories and mocked GitHub APIs |
| `npm run build` | Type-check, build and package the application without publishing |

For dependency changes, update package.json and package-lock.json together. Otherwise avoid incidental lockfile churn. Follow nearby code conventions and `.prettierrc.json`; do not reformat unrelated files.

For changes to application behavior, add or update focused regression tests and run the relevant suite. Run the application tests and build before submitting application changes. For release automation changes, run its Node test suites and check workflow YAML. Documentation-only changes do not require new tests or repeated builds unless they affect executable commands or reveal a relevant issue.

Mock Electron and external services in routine tests. Never use real account tokens as fixtures. A mocked test or successful package build does not establish a working OAuth login, chat connection, wheel interaction, Discord voice move, update installation or published release; report what was actually exercised.

`npm run publish` publishes artifacts; it is not a validation command. npm version scripts can create commits/tags. Do not run either as part of ordinary testing.

Generated output includes node_modules/, dist/, dist-electron/, release/ and coverage/. Do not commit those directories, environment files, OAuth credentials, private keys, installation tokens or persisted user data.

## Making changes and preparing PRs

1. Read the applicable instructions, relevant implementation and existing tests. Inspect the working tree before editing and preserve other contributors' work.
2. Create a focused feature/fix branch from the current default branch. This repository currently uses master. For an isolated hotfix, use the release-tag procedure below instead.
3. Trace a behavior across renderer, preload, IPC, main process and shared contracts when it crosses process boundaries. Keep types and payloads aligned; pass plain serializable data over IPC rather than SDK objects. Preserve compatibility with persisted settings or supply a migration.
4. Make the smallest complete change and verify its behavior. Keep new platform-specific code within the relevant integration where practical.
5. Give the PR a title suitable for the generated changelog. Describe the problem, resulting behavior, verification and material limitations in its description. Report live CI results for the current revision when available.
6. Select release intent using the labels below. Ordinary feature PRs should not bump the package version or edit the release changelog.

Do not treat a request to implement a change as authorization for unrelated publishing, merging, releases, deletion or permission changes. GitHub writes must stay within the action and repository explicitly authorized by the user. Do not ask again for the same authorized action.

## GitHub identity and credentials

Agent GitHub writes use the approved local GitHub App authentication workflow supplied by the current machine. The App is 5245338, snekcode-agent; the expected actor is snekcode-agent[bot], GitHub user ID 339915134. Verify the App identity and target installation access before writing. If that workflow or identity verification is unavailable, stop the affected write and explain the blocker.

Do not fall back to a personal token, GitHub CLI account credentials, Git Credential Manager, personal SSH keys, a signed-in user browser or the ChatGPT GitHub connector for writes. Read-only connector operations are allowed. Keep authentication helpers and keys outside this repository; do not hardcode an operator's local filesystem paths into reusable release code.

Request short-lived installation tokens restricted to the target repository and the permissions needed for the action. Keep tokens in memory, suppress them in output and errors, and revoke temporary write tokens after use when supported. Never put tokens in remote URLs, command arguments or global credential settings. Verify the resulting PR actor and remote ref, and report the GitHub URL.

Agent-created commits use author and committer name snekcode-agent[bot] with email `339915134+snekcode-agent[bot]@users.noreply.github.com`. Set this locally or per operation; never change the user's global Git identity or rewrite another contributor's attribution.

Deployed Actions workflows authenticate using RELEASE_APP_PRIVATE_KEY and request repository-scoped installation tokens. The App can serve multiple repositories; the release workflows derive the current owner, repository and default branch from the event. Provisioning credentials, changing App permissions and modifying branch protection are separate administrative actions requiring user authorization.

## Release labels and changelog

| Label | Release intent |
| --- | --- |
| No release label | Patch in the next ordinary release |
| `release:minor` | Minor in the next ordinary release |
| `release:major` | Major in the next ordinary release |
| `release:hotfix` | Immediate isolated patch from an existing stable release tag |

Use at most one of release:minor, release:major and release:hotfix on a PR. The largest ordinary bump among pending PRs wins. Labels govern release behavior; source branch names do not.

Changelog bullets are generated from merged PR titles and PR links. Direct commits without a matching merged PR use their commit subjects. PR descriptions do not currently supply release notes; the Hotfix base field only identifies a hotfix baseline. Edit source PR titles/labels and refresh preparation when necessary, rather than manually editing the generated release branch or PR body.

## Ordinary release workflow

Merged feature PRs trigger creation or refresh of the bot-owned automation/release branch and its PR targeting the default branch. Automation updates package.json, package-lock.json and CHANGELOG.md together. It retains pending feature changes and skips versions already tagged or reserved by prepared hotfix PRs.

Review and test the release PR, then merge it when authorized. The version-tagging workflow tags version-changing commits on the default branch and triggers the existing publishing workflow. An existing tag on the same commit is reused; a tag on another commit causes failure and must never be moved to make the workflow pass.

Do not manually commit to automation/release or create a human-owned PR using that reserved branch. Its refresh replaces bot-generated commits using force updates, so any protection rule must allow the required bot updates. Protect the default branch and maintenance branches with review and CI requirements. Agents do not merge the generated PRs automatically.

A direct version bump on the default branch releases all code already there. It is not an isolated hotfix. The legacy version-bump.js script can delete/recreate published tags; do not use it for this workflow. These release procedures supersede the README's older manual deployment instructions.

## Isolated hotfix workflow

1. Create the fix branch from the affected stable version tag, using the latest released patch on that major/minor line. Do not start from the default branch when it contains pending features. A source name such as hotfix/startup-crash is fine.
2. Open a PR initially targeting the default branch, keep its version unchanged, and add release:hotfix. Mark a draft ready for review to begin preparation.
3. Automation validates the tag baseline, creates/reuses maintenance/<major>.<minor>, and retargets that same PR. It commits the patch version, lockfile and changelog updates to the fix branch for review. Keep the generated Hotfix base field and label.
4. Review the generated changes and successful Hotfix build before merging into the maintenance branch. Historical maintenance branches receive a trusted CI-only bootstrap; pending feature code is not copied from the default branch.
5. Merging tags the maintenance merge commit and triggers publication. Automation opens a separate backport PR to the default branch and refreshes the pending ordinary release proposal.
6. Review and merge the backport when authorized, resolving any conflicts while preserving the default branch's release metadata. Do not apply release:hotfix to the backport. Its merge refreshes the existing release proposal with the fix included.

Finish one hotfix per maintenance line before preparing another. Hotfix preparation rejects stale bases, unrelated maintenance edits, cross-repository fork branches and workflow-file edits. The original hotfix PR must not be merged into the default branch; the tagging listener rejects that misrouting. The backport is the supported way to bring the fix there.

Read docs/release-workflow.md for detailed restrictions and recovery. On failure, inspect the relevant run and rerun after resolving its cause. Existing tags and backport PRs are reused where possible; never bypass a failure by deleting or moving a published tag.
