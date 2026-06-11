# yach-im

OpenClaw channel plugin project for Yach IM.

## Local development

1. Install dependencies:

   npm install

2. Build runtime files:

   npm run build

3. Install plugin locally:

   openclaw plugins install .

## Package and publish

1. Pack tarball:

   npm pack

2. Publish to ClawHub:

   clawhub package publish <tarball>.tgz --family code-plugin --source-repo tal/yach-im --source-commit $(git rev-parse HEAD) --source-ref main --changelog "Release note"
