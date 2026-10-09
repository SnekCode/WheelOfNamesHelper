const { execFileSync } = require('node:child_process');
const BRANCH = 'automation/release';
const BOT = 'snekcode-agent[bot]';
const identity = { name: BOT, email: '339915134+snekcode-agent[bot]@users.noreply.github.com' };
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const read = (sha, path) => git('show', `${sha}:${path}`);
const version = sha => JSON.parse(read(sha, 'package.json')).version;
const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
function validate(v) {
  if (!pattern.test(v) || (pattern.exec(v)[4] || '').split('.').some(p => /^\d+$/.test(p) && p.length > 1 && p[0] === '0')) throw new Error(`Invalid version: ${v}`);
  return v;
}
function bump(v, type) {
  validate(v);
  const [major, minor, patch] = pattern.exec(v).slice(1, 4).map(Number);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + (v.includes('-') ? 0 : 1)}`;
}
async function verify(github, repo) {
  if (`${repo.owner}/${repo.repo}`.toLowerCase() !== 'snekcode/wheelofnameshelper') throw new Error('Unexpected repository');
  const { data } = await github.rest.apps.listReposAccessibleToInstallation({ per_page: 100 });
  if (data.total_count !== 1 || data.repositories[0].full_name.toLowerCase() !== 'snekcode/wheelofnameshelper') throw new Error('Token must be restricted to WheelOfNamesHelper');
}
async function tag({ github, context, core }) {
  const repo = context.repo;
  await verify(github, repo);
  const commits = git('rev-list', '--first-parent', 'HEAD').split('\n').reverse();
  const before = context.payload.before;
  const start = before && !/^0+$/.test(before) ? commits.indexOf(before) : commits.length - 2;
  if (before && !/^0+$/.test(before) && start === -1) throw new Error('Push baseline is not in first-parent history');
  for (const sha of commits.slice(start + 1)) {
    const parent = git('rev-parse', `${sha}^1`);
    const v = validate(version(sha));
    if (v === version(parent)) continue;
    const ref = `tags/v${v}`;
    try {
      const { data } = await github.rest.git.getRef({ ...repo, ref });
      let object = data.object;
      while (object.type === 'tag') object = (await github.rest.git.getTag({ ...repo, tag_sha: object.sha })).data.object;
      if (object.sha !== sha) throw new Error(`v${v} already points to another commit; refusing to move it`);
      core.info(`v${v} already exists on ${sha}`);
    } catch (error) {
      if (error.status !== 404) throw error;
      try {
        await github.rest.git.createRef({ ...repo, ref: `refs/${ref}`, sha });
      } catch (createError) {
        if (createError.status !== 422) throw createError;
      }
      const { data } = await github.rest.git.getRef({ ...repo, ref });
      if (data.object.sha !== sha) throw new Error('Tag verification failed');
      core.info(`Created v${v} on ${sha}`);
    }
  }
}
async function prepare({ github, context, core }) {
  const repo = context.repo;
  await verify(github, repo);
  const head = git('rev-parse', 'HEAD');
  const current = validate(version(head));
  const history = git('rev-list', '--first-parent', 'HEAD').split('\n');
  let baseline;
  for (const sha of history) {
    const parents = git('rev-list', '--parents', '-n', '1', sha).split(' ');
    if (parents.length < 2 || version(parents[1]) !== current) { baseline = sha; break; }
  }
  const pending = history.slice(0, history.indexOf(baseline));
  const prs = new Map();
  const notes = [];
  for (const sha of pending.reverse()) {
    const linked = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, { ...repo, commit_sha: sha, per_page: 100 });
    const merged = linked.filter(pr => pr.merged_at && pr.base.ref === 'master' && pr.head.ref !== BRANCH && pr.merge_commit_sha === sha);
    if (!merged.length) notes.push(`- ${git('show', '-s', '--format=%s', sha)} (${sha.slice(0, 7)})`);
    for (const pr of merged) prs.set(pr.number, pr);
  }
  const open = await github.paginate(github.rest.pulls.list, { ...repo, state: 'open', base: 'master', head: `${repo.owner}:${BRANCH}`, per_page: 100 });
  if (open.length > 1) throw new Error('Multiple release PRs found');
  if (open.some(pr => pr.user.login !== BOT)) throw new Error('Release PR is not owned by the expected bot');
  if (!pending.length) {
    if (open.length) await github.rest.pulls.update({ ...repo, pull_number: open[0].number, state: 'closed' });
    core.info('No pending changes since the latest version bump');
    return;
  }
  let type = 'patch';
  for (const pr of prs.values()) {
    const labels = pr.labels.map(l => l.name);
    if (labels.includes('release:major')) type = 'major';
    else if (labels.includes('release:minor') && type !== 'major') type = 'minor';
    notes.push(`- ${pr.title.replace(/[\r\n]/g, ' ')} ([#${pr.number}](${pr.html_url}))`);
  }
  const next = bump(current, type);
  const pkg = JSON.parse(read(head, 'package.json'));
  const lock = JSON.parse(read(head, 'package-lock.json'));
  pkg.version = lock.version = next;
  if (lock.packages?.['']) lock.packages[''].version = next;
  const changelog = `## v${next}\n\n${notes.join('\n')}\n\n${read(head, 'CHANGELOG.md')}\n`;
  const { data: master } = await github.rest.repos.getCommit({ ...repo, ref: head });
  const tree = await github.rest.git.createTree({ ...repo, base_tree: master.commit.tree.sha, tree: [
    { path: 'package.json', mode: '100644', type: 'blob', content: JSON.stringify(pkg, null, 2) + '\n' },
    { path: 'package-lock.json', mode: '100644', type: 'blob', content: JSON.stringify(lock, null, 2) + '\n' },
    { path: 'CHANGELOG.md', mode: '100644', type: 'blob', content: changelog },
  ] });
  const commit = await github.rest.git.createCommit({ ...repo, message: `chore(release): ${next}`, tree: tree.data.sha, parents: [head], author: identity, committer: identity });
  const latest = await github.rest.git.getRef({ ...repo, ref: 'heads/master' });
  if (latest.data.object.sha !== head) throw new Error('master advanced; rerun Prepare release PR');
  try {
    const existing = await github.rest.git.getRef({ ...repo, ref: `heads/${BRANCH}` });
    const tip = await github.rest.repos.getCommit({ ...repo, ref: existing.data.object.sha });
    if (tip.data.commit.committer.email !== identity.email || !tip.data.commit.message.startsWith('chore(release):')) throw new Error('Refusing to overwrite a manually edited release branch');
    await github.rest.git.updateRef({ ...repo, ref: `heads/${BRANCH}`, sha: commit.data.sha, force: true });
  } catch (error) {
    if (error.status !== 404) throw error;
    await github.rest.git.createRef({ ...repo, ref: `refs/heads/${BRANCH}`, sha: commit.data.sha });
  }
  const remote = await github.rest.git.getRef({ ...repo, ref: `heads/${BRANCH}` });
  if (remote.data.object.sha !== commit.data.sha) throw new Error('Release branch verification failed');
  const body = `Release ${next} from master (${current}).\n\n${notes.join('\n')}\n\nThis branch is regenerated from master. Edit titles or bump labels on source PRs, then rerun Prepare release PR. Merge after tests and review to trigger tagging and publishing.`;
  const result = open.length
    ? await github.rest.pulls.update({ ...repo, pull_number: open[0].number, title: `chore(release): ${next}`, body })
    : await github.rest.pulls.create({ ...repo, head: BRANCH, base: 'master', title: `chore(release): ${next}`, body });
  if (result.data.user.login !== BOT) throw new Error('Unexpected release PR actor');
  core.info(result.data.html_url);
}
module.exports = { tag, prepare, bump, validate };
