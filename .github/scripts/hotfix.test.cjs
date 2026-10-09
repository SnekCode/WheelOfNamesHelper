const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { prepareHotfix, finishHotfix, baseVersion } = require('./hotfix.cjs');
const { releaseType, availableVersion, identity, prepare } = require('./release.cjs');
const repo = { owner: 'SnekCode', repo: 'WheelOfNamesHelper' };
const core = { info() {} };
function fixture() {
  const previous = process.cwd();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'isolated-hotfix-test-'));
  process.chdir(root);
  const env = { ...process.env, GIT_AUTHOR_NAME: identity.name, GIT_AUTHOR_EMAIL: identity.email, GIT_COMMITTER_NAME: identity.name, GIT_COMMITTER_EMAIL: identity.email };
  function git(args, input, extra = {}) { return execFileSync('git', args, { input, env: { ...env, ...extra }, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
  git(['init', '-b', 'master']);
  function write(version) {
    fs.writeFileSync('package.json', JSON.stringify({ version, dependencies: { example: '1.0.0' } }, null, 2) + '\n');
    fs.writeFileSync('package-lock.json', JSON.stringify({ version, packages: { '': { version } } }, null, 2) + '\n');
    fs.writeFileSync('CHANGELOG.md', 'Existing changelog\n');
  }
  function commit(message) { git(['add', '.']); git(['commit', '-m', message]); return git(['rev-parse', 'HEAD']); }
  write('3.1.0'); fs.writeFileSync('bug.txt', 'bug\n');
  const baseline = commit('released code');
  fs.writeFileSync('unreleased-feature.txt', 'not ready\n');
  const master = commit('pending feature');
  git(['checkout', '-b', 'fix/crash', baseline]);
  fs.writeFileSync('bug.txt', 'fixed\n');
  const source = commit('fix crash');
  const pr = { number: 42, state: 'open', draft: false, merged_at: null, title: 'Fix crash', body: 'Fix the startup crash.', html_url: 'https://example.test/pr/42', labels: [{ name: 'release:hotfix' }], user: { login: 'contributor' }, base: { ref: 'master' }, head: { ref: 'fix/crash', sha: source, repo: { full_name: 'SnekCode/WheelOfNamesHelper' } } };
  const refs = new Map([['tags/v3.1.0', baseline], ['heads/master', master], ['heads/fix/crash', source]]);
  const prs = [pr];
  const calls = { commits: [], updates: [], creates: [], tags: [] };
  const missing = () => Object.assign(new Error('missing'), { status: 404 });
  const github = { rest: {
    apps: { async listReposAccessibleToInstallation() { return { data: { total_count: 1, repositories: [{ full_name: 'SnekCode/WheelOfNamesHelper' }] } }; } },
    repos: {
      listTags: 'tags',
      listPullRequestsAssociatedWithCommit: 'associated',
      async getCommit({ ref: sha }) { return { data: { commit: { tree: { sha: git(['show', '-s', '--format=%T', sha]) }, committer: { email: identity.email }, message: git(['show', '-s', '--format=%B', sha]) } } }; },
      async getContent({ ref, path: file }) {
        try { return { data: { type: 'file', encoding: 'base64', content: Buffer.from(git(['show', `${ref}:${file}`]) + '\n').toString('base64') } }; }
        catch { throw missing(); }
      },
      async compareCommits({ base, head }) {
        const ancestor = git(['merge-base', base, head]);
        const files = git(['diff', '--name-only', `${ancestor}..${head}`]).split('\n').filter(Boolean).map(filename => ({ filename }));
        return { data: { merge_base_commit: { sha: ancestor }, status: base === head ? 'identical' : ancestor === base ? 'ahead' : ancestor === head ? 'behind' : 'diverged', files } };
      },
    },
    git: {
      async getRef({ ref }) { if (!refs.has(ref)) throw missing(); return { data: { object: { sha: refs.get(ref), type: 'commit' } } }; },
      async getCommit({ commit_sha: sha }) { return { data: { tree: { sha: git(['show', '-s', '--format=%T', sha]) }, committer: { email: git(['show', '-s', '--format=%ce', sha]) } } }; },
      async createTree({ base_tree: base, tree }) {
        const index = path.join(root, 'temporary-index');
        const extra = { GIT_INDEX_FILE: index };
        try {
          git(['read-tree', base], undefined, extra);
          for (const item of tree) {
            const blob = git(['hash-object', '-w', '--stdin'], item.content);
            git(['update-index', '--add', '--cacheinfo', `${item.mode},${blob},${item.path}`], undefined, extra);
          }
          return { data: { sha: git(['write-tree'], undefined, extra) } };
        } finally { fs.rmSync(index, { force: true }); }
      },
      async createCommit({ tree, parents, message }) {
        const sha = git(['commit-tree', tree, ...parents.flatMap(p => ['-p', p])], message);
        calls.commits.push(sha); return { data: { sha } };
      },
      async createRef({ ref, sha }) { const key = ref.replace('refs/', ''); if (refs.has(key)) throw Object.assign(new Error('exists'), { status: 422 }); refs.set(key, sha); if (key.startsWith('tags/')) calls.tags.push({ ref, sha }); },
      async updateRef({ ref, sha }) { refs.set(ref, sha); if (ref === 'heads/fix/crash') pr.head.sha = sha; },
    },
    pulls: {
      list: 'prs',
      async update(data) { const current = prs.find(p => p.number === data.pull_number); if (data.base) current.base.ref = data.base; if (data.body) current.body = data.body; if (data.title) current.title = data.title; calls.updates.push(data); return { data: current }; },
      async create(data) { const number = 43 + calls.creates.length; const created = { ...data, number, base: { ref: data.base }, head: { ref: data.head }, user: { login: identity.name }, html_url: `https://example.test/pr/${number}` }; prs.push(created); calls.creates.push(data); return { data: created }; },
    },
  }, async paginate(method, args) {
    if (method === 'tags') return [...refs.keys()].filter(k => k.startsWith('tags/')).map(k => ({ name: k.slice(5) }));
    if (method === 'associated') return [];
    return prs.filter(p => (!args.base || p.base.ref === args.base) && (!args.head || `${repo.owner}:${p.head.ref}` === args.head) && (args.state === 'all' || p.state !== 'closed'));
  } };
  const args = { github, context: { repo }, core };
  return { git, write, commit, baseline, master, source, pr, refs, prs, calls, args, cleanup() { process.chdir(previous); if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error('Unsafe cleanup path'); fs.rmSync(root, { recursive: true, force: true }); } };
}
test('patch default and mutually exclusive release labels', () => {
  assert.equal(releaseType([]), 'patch');
  assert.equal(releaseType([{ name: 'release:minor' }]), 'minor');
  assert.equal(releaseType([{ name: 'release:major' }]), 'major');
  assert.equal(releaseType([{ name: 'release:hotfix' }]), 'hotfix');
  assert.throws(() => releaseType(['release:hotfix', 'release:minor']), /only one/);
  assert.throws(() => releaseType(['release:major', 'release:minor']), /only one/);
  assert.equal(baseVersion({ body: 'Notes\nHotfix base: v3.1.0\n' }, '3.1.1'), '3.1.0');
  assert.throws(() => baseVersion({ body: 'Hotfix base: nope' }, '3.1.0'), /stable tag/);
});
test('label prepares an isolated patch, bootstraps unprivileged CI, retargets and is idempotent', async () => {
  const f = fixture();
  try {
    await prepareHotfix(f.args, f.pr);
    assert.equal(f.pr.base.ref, 'maintenance/3.1');
    assert.match(f.pr.body, /Hotfix base: v3.1.0/);
    assert.equal(JSON.parse(f.git(['show', `${f.pr.head.sha}:package.json`])).version, '3.1.1');
    assert.equal(JSON.parse(f.git(['show', `${f.pr.head.sha}:package-lock.json`])).packages[''].version, '3.1.1');
    assert.match(f.git(['show', `${f.pr.head.sha}:CHANGELOG.md`]), /Fix crash/);
    assert.throws(() => f.git(['show', `${f.pr.head.sha}:unreleased-feature.txt`]));
    const maintenance = f.refs.get('heads/maintenance/3.1');
    assert.match(f.git(['show', `${maintenance}:.github/workflows/hotfix-build.yml`]), /pull_request:/);
    const count = f.calls.commits.length;
    await prepareHotfix(f.args, f.pr);
    assert.equal(f.calls.commits.length, count);
    assert.equal(await availableVersion(f.args.github, repo, '3.1.0', 'patch'), '3.1.2');
  } finally { f.cleanup(); }
});
test('rejects hotfix branches carrying unreleased master features before making writes', async () => {
  const f = fixture();
  try {
    f.git(['checkout', '-B', 'wrong-base', f.master]);
    fs.writeFileSync('another-fix.txt', 'fix\n');
    f.pr.head.sha = f.commit('fix on master');
    await assert.rejects(prepareHotfix(f.args, f.pr), /master changes beyond/);
    assert.equal(f.calls.commits.length, 0);
  } finally { f.cleanup(); }
});
test('rejects stale patch bases and maintenance branches containing another unmerged fix', async () => {
  const f = fixture();
  try {
    f.refs.set('tags/v3.1.1', f.baseline);
    await assert.rejects(prepareHotfix(f.args, f.pr), /newer patch/);
    f.refs.delete('tags/v3.1.1');
    f.refs.set('heads/maintenance/3.1', f.source);
    await assert.rejects(prepareHotfix(f.args, f.pr), /unreleased or manual/);
  } finally { f.cleanup(); }
});
test('release tags the maintenance merge and opens a backport retaining fix ancestry but no version bump', async () => {
  const f = fixture();
  try {
    await prepareHotfix(f.args, f.pr);
    f.git(['checkout', '-B', 'maintenance/3.1', f.refs.get('heads/maintenance/3.1')]);
    f.git(['merge', '--no-ff', '-m', 'Merge isolated hotfix', f.pr.head.sha]);
    f.pr.merge_commit_sha = f.git(['rev-parse', 'HEAD']);
    f.pr.state = 'closed'; f.pr.merged_at = 'today';
    f.refs.set('heads/maintenance/3.1', f.pr.merge_commit_sha);
    await finishHotfix(f.args, f.pr);
    const tagged = f.refs.get('tags/v3.1.1');
    assert.equal(tagged, f.pr.merge_commit_sha);
    assert.throws(() => f.git(['show', `${tagged}:unreleased-feature.txt`]));
    assert.equal(f.calls.creates[0].base, 'master');
    const backport = f.refs.get('heads/automation/backport-hotfix-42');
    assert.equal(JSON.parse(f.git(['show', `${backport}:package.json`])).version, '3.1.0');
    assert.equal(f.git(['show', `${backport}:bug.txt`]), 'fixed');
    assert.equal(f.git(['merge-base', f.pr.merge_commit_sha, backport]), f.pr.merge_commit_sha);
    // Three-way merge onto a newer master must keep its version and pending features.
    f.git(['checkout', '-B', 'master', f.master]); f.write('3.2.0');
    const newerMain = f.commit('normal minor release');
    const mergedTree = f.git(['merge-tree', '--write-tree', newerMain, backport]).split('\n')[0];
    assert.equal(JSON.parse(f.git(['show', `${mergedTree}:package.json`])).version, '3.2.0');
    assert.equal(f.git(['show', `${mergedTree}:unreleased-feature.txt`]), 'not ready');
    assert.equal(f.git(['show', `${mergedTree}:bug.txt`]), 'fixed');
    await finishHotfix(f.args, f.pr);
    assert.equal(f.calls.creates.length, 1);
    assert.equal(f.calls.tags.length, 1);
    assert.equal(await availableVersion(f.args.github, repo, '3.1.0', 'patch'), '3.1.2');
    // Replaying the release after its backport has merged must also be harmless.
    f.git(['merge', '--no-ff', '-m', 'Merge backport', backport]);
    f.refs.set('heads/master', f.git(['rev-parse', 'HEAD']));
    await finishHotfix(f.args, f.pr);
    assert.equal(f.calls.creates.length, 1);
    assert.equal(f.calls.tags.length, 1);
  } finally { f.cleanup(); }
});
test('a merged hotfix targeting master is rejected and does not publish', async () => {
  const f = fixture();
  try {
    f.pr.body = 'Hotfix base: v3.1.0';
    await assert.rejects(finishHotfix(f.args, f.pr), /not master/);
    assert.equal(f.calls.tags.length, 0);
  } finally { f.cleanup(); }
});
test('master release retains pending features after a maintenance release and adds the fix after backport merge', async () => {
  const f = fixture();
  try {
    await prepareHotfix(f.args, f.pr);
    f.git(['checkout', '-B', 'maintenance/3.1', f.refs.get('heads/maintenance/3.1')]);
    f.git(['merge', '--no-ff', '-m', 'Merge isolated hotfix', f.pr.head.sha]);
    f.pr.merge_commit_sha = f.git(['rev-parse', 'HEAD']);
    f.pr.state = 'closed'; f.pr.merged_at = 'today';
    f.refs.set('heads/maintenance/3.1', f.pr.merge_commit_sha);
    await finishHotfix(f.args, f.pr);
    f.git(['checkout', '-B', 'master', f.master]);
    await prepare(f.args);
    const proposal = f.refs.get('heads/automation/release');
    assert.equal(JSON.parse(f.git(['show', `${proposal}:package.json`])).version, '3.1.2');
    assert.equal(f.git(['show', `${proposal}:unreleased-feature.txt`]), 'not ready');
    assert.match(f.git(['show', `${proposal}:CHANGELOG.md`]), /pending feature/);
    assert.equal(f.git(['show', `${proposal}:bug.txt`]), 'bug');
    const backport = f.refs.get('heads/automation/backport-hotfix-42');
    f.git(['merge', '--no-ff', '-m', 'Merge backport', backport]);
    f.refs.set('heads/master', f.git(['rev-parse', 'HEAD']));
    await prepare(f.args);
    const refreshed = f.refs.get('heads/automation/release');
    assert.equal(JSON.parse(f.git(['show', `${refreshed}:package.json`])).version, '3.1.2');
    assert.equal(f.git(['show', `${refreshed}:bug.txt`]), 'fixed');
    assert.equal(f.git(['show', `${refreshed}:unreleased-feature.txt`]), 'not ready');
    assert.equal(f.calls.creates.filter(p => p.head === 'automation/release').length, 1);
  } finally { f.cleanup(); }
});
