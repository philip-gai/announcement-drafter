#!/usr/bin/env pwsh

# Post devcontainer create script to run

git config --global pull.rebase true

Write-Host "Installing npm dependencies..."
Set-Location web-app
npm install
if (!$?) { exit 1 }

Write-Host "Running npm run build:dev..."
npm run build:dev
if (!$?) { exit 1 }
Set-Location -
Write-Host "Done."

Write-Host "Generating probot web-app/.env file for testing..."
Write-Output "# AUTO GENERATED FILE: For testing using the develop app ONLY
WEBHOOK_PROXY_URL=https://smee.io/B2IbweFaTDUwe8Hg
APP_ID=144202
PRIVATE_KEY=`"$env:PRIVATE_SSH_KEY_DEV`"
WEBHOOK_SECRET=$env:WEBHOOK_SECRET_DEV
GITHUB_CLIENT_ID=Iv1.e91dd7e62b79d5e0
GITHUB_CLIENT_SECRET=$env:GITHUBAPP_CLIENT_SECRET_DEV
LOG_LEVEL=trace
AUTH_URL=/login/oauth/authorize
CALLBACK_URL=/login/oauth/authorize/complete
COSMOS_URI=https://announcement-drafter-cosmos.documents.azure.com:443/
COSMOS_PRIMARY_KEY=$env:COSMOS_PRIMARY_KEY
DRY_RUN_COMMENTS=false
DRY_RUN_POSTS=false
" > /workspaces/announcement-drafter/web-app/.env
Write-Host "Done."

Write-Host "Cloning repos..."
$env:GITHUB_TOKEN | gh auth login --with-token
gh repo clone philip-gai/announcement-drafter-tests /workspaces/announcement-drafter-tests
if (!$?) { exit 1 }
gh repo clone philip-gai/announcement-drafter-demo /workspaces/announcement-drafter-demo
if (!$?) { exit 1 }
Write-Host "Done."
