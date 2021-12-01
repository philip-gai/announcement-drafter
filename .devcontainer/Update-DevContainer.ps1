#!/usr/bin/env pwsh

# Post devcontainer create script to run

git config --global pull.rebase true
cd web-app && npm install && cd -
