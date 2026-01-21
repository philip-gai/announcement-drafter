#!/bin/bash
#
# E2E Test Script for Announcement Drafter
#
# This script automates end-to-end testing by:
# 1. Starting the dev server
# 2. Creating a test PR in the test repository
# 3. Verifying the bot comments on the PR
# 4. Cleaning up the test PR
#
# Usage: ./scripts/e2e-test.sh [--no-cleanup]
#
# Options:
#   --no-cleanup    Keep the test PR open after testing (for manual inspection)
#

set -e

# Configuration
TEST_REPO="philip-gai/announcement-drafter-tests"
WEB_APP_DIR="$(dirname "$0")/../web-app"
CLEANUP=true
SERVER_PID=""
BRANCH_NAME=""
PR_NUMBER=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
for arg in "$@"; do
    case $arg in
        --no-cleanup)
            CLEANUP=false
            shift
            ;;
    esac
done

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    
    # Kill the dev server if running
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "Stopping dev server (PID: $SERVER_PID)..."
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
    
    # Close the PR and delete the branch if cleanup is enabled
    if [ "$CLEANUP" = true ] && [ -n "$PR_NUMBER" ]; then
        echo "Closing PR #$PR_NUMBER and deleting branch..."
        gh pr close "$PR_NUMBER" --repo "$TEST_REPO" --delete-branch 2>/dev/null || true
    elif [ -n "$PR_NUMBER" ]; then
        echo -e "${YELLOW}PR #$PR_NUMBER left open for manual inspection${NC}"
        echo "View at: https://github.com/$TEST_REPO/pull/$PR_NUMBER"
    fi
    
    # Clean up temp directory
    if [ -d "/tmp/announcement-drafter-tests" ]; then
        rm -rf /tmp/announcement-drafter-tests
    fi
}

# Set trap for cleanup on exit
trap cleanup EXIT

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Announcement Drafter E2E Test${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Step 1: Build and start the dev server
echo -e "${YELLOW}Step 1: Starting dev server...${NC}"
cd "$WEB_APP_DIR"

# Build first
echo "Building TypeScript..."
npm run build:dev

# Start the server in the background
echo "Starting probot server..."
npm run start &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to start..."
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}Server is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}Server failed to start within 30 seconds${NC}"
        exit 1
    fi
    sleep 1
done

# Give smee.io time to connect
sleep 3

# Step 2: Clone test repo and create test branch
echo ""
echo -e "${YELLOW}Step 2: Setting up test repository...${NC}"
rm -rf /tmp/announcement-drafter-tests
gh repo clone "$TEST_REPO" /tmp/announcement-drafter-tests -- --quiet
cd /tmp/announcement-drafter-tests

git checkout main
git pull --quiet
BRANCH_NAME="e2e-test-$(date +%s)"
git checkout -b "$BRANCH_NAME"

# Step 3: Create test announcement file
echo ""
echo -e "${YELLOW}Step 3: Creating test announcement file...${NC}"
mkdir -p tests
cat > tests/e2e-test-announcement.md << 'EOF'
<!--
author: philip-gai
repository: https://github.com/philip-gai/announcement-drafter-tests
category: announcements
-->

# E2E Test Announcement

This is an automated test announcement created by the e2e-test.sh script.

Testing timestamp: TIMESTAMP_PLACEHOLDER
EOF

# Replace timestamp placeholder
sed -i "s/TIMESTAMP_PLACEHOLDER/$(date -u '+%Y-%m-%d %H:%M:%S UTC')/" tests/e2e-test-announcement.md

git add .
git commit -m "Add e2e test announcement" --quiet
git push -u origin HEAD --quiet

# Step 4: Create PR
echo ""
echo -e "${YELLOW}Step 4: Creating pull request...${NC}"
PR_URL=$(gh pr create \
    --title "E2E Test Announcement - $(date '+%Y-%m-%d %H:%M')" \
    --body "Automated e2e test for announcement-drafter bot" \
    --base main \
    --head "$BRANCH_NAME" \
    2>&1)

PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')
echo "Created PR #$PR_NUMBER: $PR_URL"

# Step 5: Wait for bot to process and verify
echo ""
echo -e "${YELLOW}Step 5: Waiting for bot to comment...${NC}"

MAX_RETRIES=30
RETRY_INTERVAL=2
BOT_COMMENTED=false

for i in $(seq 1 $MAX_RETRIES); do
    echo -n "."
    
    # Check for review comments from the bot
    COMMENTS=$(gh api "/repos/$TEST_REPO/pulls/$PR_NUMBER/comments" 2>/dev/null || echo "[]")
    BOT_COMMENT=$(echo "$COMMENTS" | jq -r '.[] | select(.user.login | contains("announcement-drafter")) | .body' 2>/dev/null || echo "")
    
    if [ -n "$BOT_COMMENT" ]; then
        BOT_COMMENTED=true
        break
    fi
    
    sleep $RETRY_INTERVAL
done

echo ""

# Step 6: Report results
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Test Results${NC}"
echo -e "${GREEN}========================================${NC}"

if [ "$BOT_COMMENTED" = true ]; then
    echo -e "${GREEN}✅ SUCCESS: Bot commented on the PR!${NC}"
    echo ""
    echo "Bot comment preview:"
    echo "---"
    echo "$BOT_COMMENT" | head -10
    echo "---"
    EXIT_CODE=0
else
    echo -e "${RED}❌ FAILURE: Bot did not comment within $((MAX_RETRIES * RETRY_INTERVAL)) seconds${NC}"
    echo ""
    echo "Debug info:"
    echo "- PR URL: https://github.com/$TEST_REPO/pull/$PR_NUMBER"
    echo "- Check webhook deliveries: https://github.com/settings/apps/announcement-drafter-develop/advanced"
    EXIT_CODE=1
fi

echo ""
echo "PR: https://github.com/$TEST_REPO/pull/$PR_NUMBER"

exit $EXIT_CODE
