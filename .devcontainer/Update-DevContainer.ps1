#!/usr/bin/env pwsh

# Post devcontainer create script to run

git config --global pull.rebase true
Set-Location web-app; npm install; Set-Location -
if (!$?) { exit 1 }

Write-Output "
# AUTO GENERATED FILE: For testing using the develop app ONLY
WEBHOOK_PROXY_URL=https://smee.io/B2IbweFaTDUwe8Hg
APP_ID=144202
PRIVATE_KEY="$env:PRIVATE_SSH_KEY_DEV"
WEBHOOK_SECRET=$env:WEBHOOK_SECRET_DEV
GITHUB_CLIENT_ID=Iv1.e91dd7e62b79d5e0
GITHUB_CLIENT_SECRET=$env:GITHUBAPP_CLIENT_SECRET_DEV
LOG_LEVEL=debug
AUTH_URL=/login/oauth/authorize
CALLBACK_URL=/login/oauth/authorize/complete
COSMOS_URI=https://announcement-drafter-cosmos.documents.azure.com:443/
COSMOS_PRIMARY_KEY=$env:COSMOS_PRIMARY_KEY
DRY_RUN_COMMENTS=false
DRY_RUN_POSTS=false
" >> /workspaces/announcement-drafter/web-app/.env
