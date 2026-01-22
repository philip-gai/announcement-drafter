# Testing

This document describes how to test changes to the Announcement Drafter app.

## Automated E2E Testing

An automated script is available to run e2e tests without manual intervention.

### Prerequisites

- Node.js >= 22
- GitHub CLI (`gh`) authenticated with access to `philip-gai/announcement-drafter-tests`
- The web-app dependencies installed (`npm install` in `web-app/`)

### Running the Script

From the repository root:

```bash
# Run full e2e test with automatic cleanup
./scripts/e2e-test.sh

# Run test and keep the PR open for manual inspection
./scripts/e2e-test.sh --no-cleanup
```

### What the Script Does

1. **Builds the app** - Compiles TypeScript in the `web-app/` directory
2. **Starts the dev server** - Runs the probot server on `http://localhost:3000`
3. **Clones the test repository** - Clones `philip-gai/announcement-drafter-tests` to `/tmp/`
4. **Creates a test announcement** - Adds an announcement file in the `tests/` folder
5. **Creates a pull request** - Opens a PR to trigger the webhook
6. **Verifies bot response** - Waits up to 60 seconds for the bot to comment
7. **Reports results** - Shows success/failure and bot comment preview
8. **Cleans up** - Closes the PR, deletes the branch, and stops the server

### Troubleshooting

If the test fails:

1. **Check webhook deliveries** - Visit the [app settings](https://github.com/settings/apps/announcement-drafter-develop/advanced) to see if webhooks were received
2. **Check smee.io connection** - Ensure the webhook forwarding is working
3. **Verify `.env` configuration** - Make sure `web-app/.env` has the correct settings
4. **Run with `--no-cleanup`** - Keep the PR open to manually inspect the state

## Manual Testing

1. Open a terminal
2. Navigate to the web app directory: `cd web-app`
3. Run the app in dev mode: `npm run dev`
4. Using the test repository: <https://github.com/philip-gai/announcement-drafter-tests>
   1. Create a pull request, and verify that your locally running probot app is receiving the webhook events
5. You can also view the develop app settings and webhook deliveries on the [announcement-drafter-develop app settings page](https://github.com/settings/apps/announcement-drafter-develop/advanced)
