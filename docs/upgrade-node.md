# Upgrade Node version

This document describes how to upgrade the Node version used by the Announcement Drafter app.

## Steps

1. Update the node version in [package.json](/web-app/package.json)
2. Update the nodesource link in [Dockerfile](/.devcontainer/Dockerfile)
3. Update the `node-version` in [action.yml](/.github/workflows/composite/web-app-build-test/action.yml)
4. Rebuild codespace
5. Check `node -v`
6. Continue [testing](./testing.md)
