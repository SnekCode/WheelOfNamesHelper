const fs = require('node:fs');
const path = require('node:path');
const { bump, validate, verify, createTag, releaseType, identity, prepare } = require('./release.cjs');
const CI_PATH = '.github/workflows/hotfix-build.yml';
const stable = /^\d+\.\d+\.\d+$/;
async function contents(github, repo, ref, file) {
  const { data } = await github.rest.repos.getContent({ ...repo, ref, path: file });
  if (data.type !== 'file' || data.encoding !== 'base64') throw new Error(`Cannot read ${file} at ${ref}`);
  return Buffer.from(data.content, 'base64').toString('utf8');
}
async function taggedCommit(github, repo, tag) {
  let object = (await github.rest.git.getRef({ ...repo, ref: `tags/${tag}` })).data.object;
  while (object.type === 'tag') object = (await github.rest.git.getTag({ ...repo, tag_sha: object.sha })).data.object;
  if (object.type !== 'commit') throw new Error('Hotfix base is not a commit');
  return object.sha;
}
async function ref(github, repo, name) {
  try { return (await github.rest.git.getRef({ ...repo, ref: `heads/${name}` })).data.object.sha; }
  catch (error) { if (error.status === 404) return null; throw error; }
}
async function commitFiles(github, repo, parent, message, files) {
  const base = (await github.rest.git.getCommit({ ...repo, commit_sha: parent })).data;
  const tree = await github.rest.git.createTree({ ...repo, base_tree: base.tree.sha, tree: files.map(([file, content]) => ({ path: file, mode: '100644', type: 'blob', content })) });
  return (await github.rest.git.createCommit({ ...repo, parents: [parent], tree: tree.data.sha, message, author: identity, committer: identity })).data.sha;
}
async function compare(github, repo, base, head) {
  return (await github.rest.repos.compareCommits({ ...repo, base, head })).data;
}
function baseVersion(pr, packageVersion) {
  const fields = [...(pr.body || '').matchAll(/^Hotfix base: (.*)$/gm)];
  if (fields.some(field => !/^v\d+\.\d+\.\d+$/.test(field[1].trim()))) throw new Error('Hotfix base must be a stable tag such as v3.1.0');
  const matches = [...(pr.body || '').matchAll(/^Hotfix base: v(\d+\.\d+\.\d+)\s*$/gm)];
  if (matches.length > 1) throw new Error('Use one Hotfix base field');
  const v = matches[0]?.[1] || packageVersion;
  validate(v);
  if (!stable.test(v)) throw new Error('Hotfixes require a stable release tag');
  return v;
}
async function maintenance(github, repo, branch, tagSha, version, core) {
  const trustedCI = fs.readFileSync(path.join(__dirname, '..', 'workflows', 'hotfix-build.yml'), 'utf8').replace(/\r\n/g, '\n');
  let tip = await ref(github, repo, branch);
  if (!tip) {
    const tagCI = await contents(github, repo, tagSha, CI_PATH).catch(error => { if (error.status === 404) return null; throw error; });
    const ciCommit = tagCI === trustedCI ? tagSha : await commitFiles(github, repo, tagSha, 'ci: enable reviewed hotfix builds', [[CI_PATH, trustedCI]]);
    try { await github.rest.git.createRef({ ...repo, ref: `refs/heads/${branch}`, sha: ciCommit }); }
    catch (error) { if (error.status !== 422) throw error; }
    tip = await ref(github, repo, branch);
  }
  const tipVersion = JSON.parse(await contents(github, repo, tip, 'package.json')).version;
  if (tipVersion !== version) throw new Error(`Maintenance branch advanced to ${tipVersion}; recreate the hotfix from its latest release tag`);
  if (tip !== tagSha) {
    const delta = await compare(github, repo, tagSha, tip);
    const commit = (await github.rest.git.getCommit({ ...repo, commit_sha: tip })).data;
    if (delta.merge_base_commit.sha !== tagSha || delta.files.length !== 1 || delta.files[0].filename !== CI_PATH || commit.committer.email !== identity.email) throw new Error('Maintenance branch has unreleased or manual changes');
  }
  const existingCI = await contents(github, repo, tip, CI_PATH).catch(error => { if (error.status === 404) return null; throw error; });
  if (existingCI !== trustedCI) throw new Error('Maintenance CI differs from trusted master; update it separately before preparing a hotfix');
  core.info(`Hotfix target: ${branch}`);
  return tip;
}
async function prepareHotfix({ github, context, core }, pr) {
  const repo = context.repo;
  if (pr.head.repo?.full_name.toLowerCase() !== 'snekcode/wheelofnameshelper') throw new Error('Hotfix automation requires a branch in WheelOfNamesHelper');
  if (pr.draft) { core.info('Mark the hotfix ready for review before preparation'); return; }
  const pkgText = await contents(github, repo, pr.head.sha, 'package.json');
  const pkg = JSON.parse(pkgText);
  const baseline = baseVersion(pr, pkg.version);
  const baseTag = `v${baseline}`;
  const baseSha = await taggedCommit(github, repo, baseTag);
  const tagPkg = JSON.parse(await contents(github, repo, baseSha, 'package.json'));
  if (tagPkg.version !== baseline) throw new Error('Tag and package version disagree');
  const [major, minor, patch] = baseline.split('.').map(Number);
  const tags = await github.paginate(github.rest.repos.listTags, { ...repo, per_page: 100 });
  if (tags.some(t => { const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(t.name); return m && +m[1] === major && +m[2] === minor && +m[3] > patch; })) throw new Error('A newer patch is already released on this maintenance line; branch from that tag');
  const mainSha = await ref(github, repo, 'master');
  const delta = await compare(github, repo, baseSha, pr.head.sha);
  if (delta.merge_base_commit.sha !== baseSha || delta.status !== 'ahead') throw new Error('Create the hotfix branch from the affected version tag');
  // Sharing main commits beyond the release tag means unreleased features slipped into this hotfix.
  const baselineMain = await compare(github, repo, baseSha, mainSha);
  const sourceMain = await compare(github, repo, pr.head.sha, mainSha);
  if (baselineMain.merge_base_commit.sha !== sourceMain.merge_base_commit.sha) throw new Error('Hotfix branch includes master changes beyond the release tag');
  if (delta.files.length >= 300) throw new Error('Hotfix comparison is too large; split the changes');
  if (delta.files.some(f => f.filename.startsWith('.github/workflows/'))) throw new Error('Hotfix PRs cannot edit workflow files; use a separate workflow PR');
  const target = `maintenance/${major}.${minor}`;
  if (!['master', target].includes(pr.base.ref)) throw new Error('Unexpected hotfix PR target');
  const pending = await github.paginate(github.rest.pulls.list, { ...repo, state: 'open', base: target, per_page: 100 });
  if (pending.some(other => other.number !== pr.number)) throw new Error('Another hotfix is open on this maintenance line; finish it before preparing the next one');
  const next = bump(baseline, 'patch');
  if (![baseline, next].includes(pkg.version)) throw new Error('Hotfix version must be the baseline or its next patch');
  // Reject tag collisions before changing the author's branch.
  try { await github.rest.git.getRef({ ...repo, ref: `tags/v${next}` }); throw new Error(`v${next} is already released`); }
  catch (error) { if (error.status !== 404) throw error; }
  const targetSha = await maintenance(github, repo, target, baseSha, baseline, core);
  const lockText = await contents(github, repo, pr.head.sha, 'package-lock.json');
  const lock = JSON.parse(lockText);
  const previousNotes = await contents(github, repo, baseSha, 'CHANGELOG.md');
  pkg.version = lock.version = next;
  if (lock.packages?.['']) lock.packages[''].version = next;
  const note = `## v${next}\n\n- ${pr.title.replace(/[\r\n]/g, ' ')} ([#${pr.number}](${pr.html_url}))\n\n`;
  const changes = [['package.json', JSON.stringify(pkg, null, 2) + '\n'], ['package-lock.json', JSON.stringify(lock, null, 2) + '\n'], ['CHANGELOG.md', note + previousNotes]];
  const originals = [pkgText, lockText, await contents(github, repo, pr.head.sha, 'CHANGELOG.md')];
  let preparedSha = pr.head.sha;
  if (changes.some(([, content], i) => content !== originals[i])) {
    preparedSha = await commitFiles(github, repo, pr.head.sha, `chore(hotfix): prepare v${next}`, changes);
    const currentSource = await ref(github, repo, pr.head.ref);
    if (currentSource !== pr.head.sha || await ref(github, repo, target) !== targetSha) throw new Error('Hotfix branches advanced; rerun preparation');
    await github.rest.git.updateRef({ ...repo, ref: `heads/${pr.head.ref}`, sha: preparedSha, force: false });
    if (await ref(github, repo, pr.head.ref) !== preparedSha) throw new Error('Prepared hotfix ref verification failed');
  }
  // Preserve the author's description and record the inferred baseline for retries.
  const body = /^Hotfix base: /m.test(pr.body || '') ? pr.body : `${(pr.body || '').trim()}\n\nHotfix base: ${baseTag}\n`;
  if (pr.base.ref !== target || body !== pr.body) await github.rest.pulls.update({ ...repo, pull_number: pr.number, base: target, body });
  core.info(`Prepared v${next} in PR #${pr.number}; review the changes and Hotfix build before merging`);
}
async function backport({ github, context, core }, pr, baseline) {
  const repo = context.repo;
  const branch = `automation/backport-hotfix-${pr.number}`;
  const baseSha = await taggedCommit(github, repo, `v${baseline}`);
  const pkg = JSON.parse(await contents(github, repo, pr.merge_commit_sha, 'package.json'));
  const lock = JSON.parse(await contents(github, repo, pr.merge_commit_sha, 'package-lock.json'));
  // Restore baseline metadata so the three-way merge keeps master's current version.
  // Dependencies and original contributor commits stay in the branch ancestry.
  pkg.version = lock.version = baseline;
  if (lock.packages?.['']) lock.packages[''].version = baseline;
  const files = [['package.json', JSON.stringify(pkg, null, 2) + '\n'], ['package-lock.json', JSON.stringify(lock, null, 2) + '\n'], ['CHANGELOG.md', await contents(github, repo, baseSha, 'CHANGELOG.md')]];
  let tip = await ref(github, repo, branch);
  if (!tip) {
    tip = await commitFiles(github, repo, pr.merge_commit_sha, `chore(backport): preserve master release metadata for hotfix #${pr.number}`, files);
    await github.rest.git.createRef({ ...repo, ref: `refs/heads/${branch}`, sha: tip });
    if (await ref(github, repo, branch) !== tip) throw new Error('Backport ref verification failed');
  }
  const existing = await github.paginate(github.rest.pulls.list, { ...repo, state: 'all', base: 'master', head: `${repo.owner}:${branch}`, per_page: 100 });
  if (existing.length) {
    if (existing.length !== 1 || existing[0].user.login !== identity.name) throw new Error('Unexpected backport PR owner');
    core.info(`Backport already exists: ${existing[0].html_url}`);
    return;
  }
  const result = await github.rest.pulls.create({ ...repo, base: 'master', head: branch, title: `Backport hotfix #${pr.number}: ${pr.title}`, body: `Bring the fix from ${pr.html_url} into master.\n\nThe maintenance version bump and release notes are reverted relative to the affected tag so master keeps its own release metadata. Original contributor history and dependency changes are preserved. Review and resolve any code conflicts before merging; do not apply release:hotfix to this backport. Merging refreshes the pending release PR.` });
  if (result.data.user.login !== identity.name) throw new Error('Unexpected backport actor');
  core.info(result.data.html_url);
}
async function finishHotfix(args, pr) {
  const { github, context, core } = args;
  const repo = context.repo;
  const baseline = baseVersion(pr, '');
  const expectedTarget = `maintenance/${baseline.split('.').slice(0, 2).join('.')}`;
  if (pr.base.ref !== expectedTarget) throw new Error('Merged hotfix must target its maintenance branch, not master');
  const next = bump(baseline, 'patch');
  const mergedPackage = JSON.parse(await contents(github, repo, pr.merge_commit_sha, 'package.json'));
  if (mergedPackage.version !== next) throw new Error('Merged hotfix has an unexpected version');
  const baseSha = await taggedCommit(github, repo, `v${baseline}`);
  const delta = await compare(github, repo, baseSha, pr.merge_commit_sha);
  if (delta.merge_base_commit.sha !== baseSha) throw new Error('Hotfix merge does not descend from its baseline');
  let alreadyTagged = false;
  try { alreadyTagged = await taggedCommit(github, repo, `v${next}`) === pr.merge_commit_sha; }
  catch (error) { if (error.status !== 404) throw error; }
  if (!alreadyTagged) {
    const mainSha = await ref(github, repo, 'master');
    const baseMain = await compare(github, repo, baseSha, mainSha);
    const mergedMain = await compare(github, repo, pr.merge_commit_sha, mainSha);
    if (baseMain.merge_base_commit.sha !== mergedMain.merge_base_commit.sha) throw new Error('Hotfix merge includes master changes beyond its baseline');
  }
  await createTag(github, repo, next, pr.merge_commit_sha, core);
  await backport(args, pr, baseline);
}
async function run(args) {
  const { github, context, core } = args;
  await verify(github, context.repo);
  const pr = (await github.rest.pulls.get({ ...context.repo, pull_number: context.payload.pull_request.number })).data;
  const type = releaseType(pr.labels);
  if (type !== 'hotfix') {
    if (pr.base.ref.startsWith('maintenance/')) throw new Error('Maintenance PRs require release:hotfix');
    return;
  }
  if (pr.state === 'closed') {
    if (!pr.merged_at) return;
    await finishHotfix(args, pr);
  } else {
    await prepareHotfix(args, pr);
  }
  // Refresh master's proposal independently; maintenance releases never become its baseline.
  await prepare(args);
  core.info('Release proposal refreshed; the backport still needs review and merge');
}
module.exports = { run, prepareHotfix, finishHotfix, backport, baseVersion, maintenance };
