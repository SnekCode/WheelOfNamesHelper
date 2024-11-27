import fs from 'fs';
import { execSync } from 'child_process';

const incrementVersion = (version, type) => {
  const [major, minor, patch] = version.split('.').map(Number);
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unknown version increment type: ${type}`);
  }
};

const main = () => {
  const type = process.argv[2];
  const channel = process.argv[3] || 'stable';
  if (!['major', 'minor', 'patch'].includes(type)) {
    console.error('Usage: node version-bump.js <major|minor|patch>');
    process.exit(1);
  }
  if (!["stable", "beta", "alpha"].includes(channel)) {
    console.error('Usage: node version-bump.js <major|minor|patch> <stable|beta|alpha>');
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const newVersion = incrementVersion(packageJson.version, type);
  if (channel !== "stable") {
    packageJson.version = `${newVersion}-${channel}`;
  } else {
  packageJson.version = newVersion;
  }
  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
  execSync(`git add package.json`);
  execSync(`git commit -m "chore: bump version to ${newVersion}"`);
  execSync(`git push origin master`);
  execSync(`git tag v${newVersion}`);
  execSync(`git push origin tag v${newVersion}`);

  console.log(`Version bumped to ${newVersion} and tagged as v${newVersion}`);
};

main();