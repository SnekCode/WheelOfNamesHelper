const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { tag, prepare, bump, validate } = require('./release.cjs');
const repo = { owner: 'SnekCode', repo: 'WheelOfNamesHelper' };
const bot = 'snekcode-agent[bot]';
const email = '339915134+snekcode-agent[bot]@users.noreply.github.com';
const core = { info() {} };
function fixture() {
  const original = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-test-'));
  process.chdir(dir);
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'master');
  git('config', 'user.name', bot);
  git('config', 'user.email', email);
  function commit(version, subject) {
    fs.writeFileSync('package.json', JSON.stringify({ version }));
    fs.writeFileSync('package-lock.json', JSON.stringify({ version, packages: { '': { version } } }));
    fs.writeFileSync('CHANGELOG.md', 'Existing changelog\n');
    fs.appendFileSync('feature.txt', subject + '\n');
    git('add', '.'); git('commit', '-m', subject);
    return git('rev-parse', 'HEAD');
  }
  return { git, commit, cleanup() { process.chdir(original); fs.rmSync(dir, { recursive: true, force: true }); } };
}
function api(head, linked = [], open = []) {
  const refs = new Map([['heads/master', { sha: head, type: 'commit' }]]);
  const calls = { trees: [], created: [], closed: [], prs: [] };
  const github = { rest: {
    apps: { async listReposAccessibleToInstallation() { return { data: { total_count: 1, repositories: [{ full_name: 'SnekCode/WheelOfNamesHelper' }] } }; } },
    repos: {
      listPullRequestsAssociatedWithCommit: 'associated',
      async getCommit({ ref }) { return { data: { commit: { tree: { sha: 'base-tree' }, committer: { email }, message: 'chore(release): generated' } } }; },
    },
    git: {
      async getRef({ ref }) { if (!refs.has(ref)) throw Object.assign(new Error('missing'), { status: 404 }); return { data: { object: refs.get(ref) } }; },
      async createRef({ ref, sha }) { refs.set(ref.replace('refs/', ''), { sha, type: 'commit' }); calls.created.push({ ref, sha }); },
      async updateRef({ ref, sha }) { refs.set(ref, { sha, type: 'commit' }); },
      async createTree(data) { calls.trees.push(data); return { data: { sha: 'tree' } }; },
      async createCommit() { return { data: { sha: 'release-commit' } }; },
    },
    pulls: {
      list: 'open',
      async update(data) { if (data.state === 'closed') calls.closed.push(data); else calls.prs.push(data); return { data: { user: { login: bot }, html_url: 'https://example.test/pr' } }; },
      async create(data) { calls.prs.push(data); return { data: { user: { login: bot }, html_url: 'https://example.test/pr' } }; },
    },
  }, async paginate(method, args) { return method === 'associated' ? linked.filter(pr => pr.merge_commit_sha === args.commit_sha) : open; } };
  return { github, refs, calls };
}
test('version validation and bump policies', () => {
  assert.equal(bump('3.0.3', 'patch'), '3.0.4');
  assert.equal(bump('3.0.3', 'minor'), '3.1.0');
  assert.equal(bump('3.0.3', 'major'), '4.0.0');
  assert.equal(bump('3.1.0-beta.2', 'patch'), '3.1.0');
  for (const v of ['03.0.0', '3.0', '3.0.0-beta.01', '3.0.0;echo']) assert.throws(() => validate(v));
});
test('unchanged versions skip; hotfix transition tags its commit; retries are idempotent; conflicts fail', async () => {
  const f = fixture();
  try {
    const baseline = f.commit('3.0.3', 'baseline');
    const feature = f.commit('3.0.3', 'feature');
    const a = api(feature);
    await tag({ github: a.github, context: { repo, payload: { before: baseline } }, core });
    assert.equal(a.calls.created.length, 0);
    const hotfix = f.commit('3.0.4', 'hotfix');
    f.commit('3.0.4', 'later feature');
    await tag({ github: a.github, context: { repo, payload: { before: feature } }, core });
    assert.deepEqual(a.calls.created, [{ ref: 'refs/tags/v3.0.4', sha: hotfix }]);
    await tag({ github: a.github, context: { repo, payload: { before: feature } }, core });
    assert.equal(a.calls.created.length, 1);
    a.refs.set('tags/v3.0.4', { sha: baseline, type: 'commit' });
    await assert.rejects(tag({ github: a.github, context: { repo, payload: { before: feature } }, core }), /refusing to move/);
  } finally { f.cleanup(); }
});
test('preparation aggregates PRs, uses largest bump and synchronizes lockfile/changelog', async () => {
  const f = fixture();
  try {
    f.commit('3.0.3', 'baseline');
    const first = f.commit('3.0.3', 'feature one');
    const second = f.commit('3.0.3', 'feature two');
    const linked = [first, second].map((sha, i) => ({ number: i + 1, merged_at: 'today', base: { ref: 'master' }, head: { ref: 'feature' }, merge_commit_sha: sha, labels: [{ name: i ? 'release:minor' : 'release:patch' }], title: `Feature ${i}`, html_url: `https://example.test/${i}` }));
    const a = api(second, linked);
    await prepare({ github: a.github, context: { repo }, core });
    const entries = a.calls.trees[0].tree;
    assert.equal(JSON.parse(entries[0].content).version, '3.1.0');
    assert.equal(JSON.parse(entries[1].content).packages[''].version, '3.1.0');
    assert.match(entries[2].content, /Feature 0/);
    assert.match(entries[2].content, /Feature 1/);
    assert.equal(a.calls.prs[0].base, 'master');
  } finally { f.cleanup(); }
});
test('hotfix or release merge closes stale proposal; next feature starts from the new version', async () => {
  const f = fixture();
  try {
    f.commit('3.0.3', 'baseline');
    f.commit('3.0.3', 'feature');
    const hotfix = f.commit('3.0.4', 'hotfix release');
    const a = api(hotfix, [], [{ number: 8, user: { login: bot } }]);
    await prepare({ github: a.github, context: { repo }, core });
    assert.equal(a.calls.closed.length, 1);
    assert.equal(a.calls.trees.length, 0);
    const head = f.commit('3.0.4', 'new feature');
    const b = api(head);
    await prepare({ github: b.github, context: { repo }, core });
    assert.equal(JSON.parse(b.calls.trees[0].tree[0].content).version, '3.0.5');
    assert.doesNotMatch(b.calls.trees[0].tree[2].content, /hotfix release/);
  } finally { f.cleanup(); }
});
