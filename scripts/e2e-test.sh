#!/bin/bash
#
# E2E Test Script for Announcement Drafter
#
# This script automates end-to-end testing by:
# 1. Checking for valid OAuth token in CosmosDB
# 2. Starting the dev server
# 3. Creating a test PR in the test repository
# 4. Verifying the bot comments on the PR
# 5. Optionally merging and verifying discussion creation with labels
#
# Usage: ./scripts/e2e-test.sh [--no-cleanup] [--merge] [--skip-auth-check]
#
# Options:
#   --no-cleanup      Keep the test PR open after testing (for manual inspection)
#   --merge           Merge the PR and verify discussion creation (requires admin rights)
#   --skip-auth-check Skip the OAuth token check
#
# Prerequisites:
# - User must be authenticated with the dev app (visit http://localhost:3000/login/oauth/authorize)
# - The test markdown file must use HTML comment format (<!-- ... -->) not YAML front matter
#

set -e

# Configuration
TEST_REPO="philip-gai/announcement-drafter-tests"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_APP_DIR="$SCRIPT_DIR/../web-app"
CLEANUP=true
MERGE_PR=false
SKIP_AUTH_CHECK=false
SERVER_PID=""
BRANCH_NAME=""
PR_NUMBER=""
DISCUSSION_URL=""

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
        --merge)
            MERGE_PR=true
            shift
            ;;
        --skip-auth-check)
            SKIP_AUTH_CHECK=true
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
    
    # Also kill any process on port 3000
    lsof -ti :3000 | xargs -r kill -9 2>/dev/null || true
    
    # Close the PR and delete the branch if cleanup is enabled and PR wasn't merged
    if [ "$CLEANUP" = true ] && [ -n "$PR_NUMBER" ] && [ -z "$DISCUSSION_URL" ]; then
        echo "Closing PR #$PR_NUMBER and deleting branch..."
        gh pr close "$PR_NUMBER" --repo "$TEST_REPO" --delete-branch 2>/dev/null || true
    elif [ -n "$PR_NUMBER" ] && [ -z "$DISCUSSION_URL" ]; then
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

# Step 0: Check OAuth token (required for merge flow)
if [ "$MERGE_PR" = true ] && [ "$SKIP_AUTH_CHECK" = false ]; then
    echo -e "${YELLOW}Step 0: Checking OAuth token...${NC}"
    cd "$WEB_APP_DIR"
    
    # Get the current user's login
    USER_LOGIN=$(gh api user --jq '.login' 2>/dev/null || echo "")
    if [ -z "$USER_LOGIN" ]; then
        echo -e "${RED}Error: Could not determine GitHub user login${NC}"
        exit 1
    fi
    
    # Check if token exists in CosmosDB
    TOKEN_CHECK=$(node -e "
require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');
const client = new CosmosClient({ endpoint: process.env.COSMOS_URI, key: process.env.COSMOS_PRIMARY_KEY });
client.database('AnnouncementDrafter').container('Tokens').item('$USER_LOGIN', '$USER_LOGIN').read()
  .then(r => {
    if (r.resource) {
      const expired = Date.now() > Date.parse(r.resource.refreshTokenExpiresAt);
      console.log(expired ? 'expired' : 'valid');
    } else {
      console.log('missing');
    }
  })
  .catch(() => console.log('error'));
" 2>/dev/null)
    
    if [ "$TOKEN_CHECK" = "valid" ]; then
        echo -e "${GREEN}✅ OAuth token found for $USER_LOGIN${NC}"
    elif [ "$TOKEN_CHECK" = "expired" ]; then
        echo -e "${RED}❌ OAuth token for $USER_LOGIN is expired${NC}"
        echo ""
        echo "Please re-authenticate by visiting:"
        echo "  http://localhost:3000/login/oauth/authorize"
        echo ""
        echo "Then run this script again."
        exit 1
    else
        echo -e "${YELLOW}⚠️  No OAuth token found for $USER_LOGIN${NC}"
        echo ""
        echo "For the --merge flow to work, you need to authenticate first."
        echo "Please visit: http://localhost:3000/login/oauth/authorize"
        echo ""
        echo "Then run this script again, or use --skip-auth-check to skip this check."
        exit 1
    fi
    echo ""
fi

# Step 1: Build and start the dev server
echo -e "${YELLOW}Step 1: Starting dev server...${NC}"
cd "$WEB_APP_DIR"

# Kill any existing process on port 3000
lsof -ti :3000 | xargs -r kill -9 2>/dev/null || true
sleep 1

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

# Step 3: Create test announcement file from fixtures
# IMPORTANT: The file must use HTML comment format (<!-- ... -->) for YAML header,
# NOT YAML front matter (--- ... ---). The parser looks for <!-- and --> delimiters.
echo ""
echo -e "${YELLOW}Step 3: Creating test announcement file from fixtures...${NC}"
mkdir -p tests

# Copy fixture and modify for test repo
FIXTURE_FILE="$SCRIPT_DIR/../web-app/test/fixtures/discussion_posts/with-labels.md"
if [ -f "$FIXTURE_FILE" ]; then
    # Copy fixture and update repository URL and category for test repo
    sed -e 's|repository: https://github.com/philip-gai/announcement-drafter|repo: https://github.com/philip-gai/announcement-drafter-tests|' \
        -e 's|category: announcements|category: Announcements|' \
        "$FIXTURE_FILE" > tests/e2e-test-announcement.md
    
    # Append timestamp to make each test unique
    echo "" >> tests/e2e-test-announcement.md
    echo "Test run: $(date -u '+%Y-%m-%d %H:%M:%S UTC')" >> tests/e2e-test-announcement.md
else
    echo -e "${RED}Fixture file not found: $FIXTURE_FILE${NC}"
    exit 1
fi

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
    
    # Check if it's an error comment
    if echo "$BOT_COMMENT" | grep -q "⛔️"; then
        echo -e "${RED}⚠️  Bot comment indicates an error${NC}"
        EXIT_CODE=1
    else
        EXIT_CODE=0
    fi
else
    echo -e "${RED}❌ FAILURE: Bot did not comment within $((MAX_RETRIES * RETRY_INTERVAL)) seconds${NC}"
    echo ""
    echo "Debug info:"
    echo "- PR URL: https://github.com/$TEST_REPO/pull/$PR_NUMBER"
    echo "- Check webhook deliveries: https://github.com/settings/apps/announcement-drafter-develop/advanced"
    EXIT_CODE=1
fi

# Step 7: Optionally merge and verify discussion creation
if [ "$MERGE_PR" = true ] && [ "$EXIT_CODE" -eq 0 ]; then
    echo ""
    echo -e "${YELLOW}Step 7: Merging PR and verifying discussion creation...${NC}"
    
    # Merge the PR (requires admin rights due to branch protection)
    echo "Merging PR #$PR_NUMBER..."
    if gh pr merge "$PR_NUMBER" --repo "$TEST_REPO" --squash --delete-branch --admin 2>/dev/null; then
        echo -e "${GREEN}PR merged successfully${NC}"
        
        # Wait for webhook to process and discussion to be created
        echo "Waiting for discussion to be created..."
        sleep 10
        
        # Check for success reply comment on the PR
        SUCCESS_COMMENT=$(gh api "/repos/$TEST_REPO/pulls/$PR_NUMBER/comments" 2>/dev/null | \
            jq -r '.[] | select(.body | contains("🎉")) | .body' 2>/dev/null | head -1 || echo "")
        
        if [ -n "$SUCCESS_COMMENT" ]; then
            # Extract discussion URL from the comment
            DISCUSSION_URL=$(echo "$SUCCESS_COMMENT" | grep -oE 'https://github.com/[^)]+/discussions/[0-9]+' | head -1 || echo "")
            
            if [ -n "$DISCUSSION_URL" ]; then
                echo -e "${GREEN}✅ Discussion created: $DISCUSSION_URL${NC}"
                
                # Verify labels were applied (this may fail due to API permissions)
                DISCUSSION_NUM=$(echo "$DISCUSSION_URL" | grep -oE '[0-9]+$')
                echo ""
                echo "Note: To verify labels, check the discussion manually:"
                echo "  $DISCUSSION_URL"
                echo ""
                echo "Expected labels: enhancement, documentation"
            else
                echo -e "${YELLOW}⚠️  Could not extract discussion URL from success comment${NC}"
            fi
        else
            echo -e "${RED}❌ No success comment found - discussion may not have been created${NC}"
            echo ""
            echo "Check the server logs for errors."
            EXIT_CODE=1
        fi
    else
        echo -e "${RED}❌ Failed to merge PR (may need --admin flag or admin rights)${NC}"
        EXIT_CODE=1
    fi
fi

echo ""
echo "PR: https://github.com/$TEST_REPO/pull/$PR_NUMBER"
if [ -n "$DISCUSSION_URL" ]; then
    echo "Discussion: $DISCUSSION_URL"
fi

exit $EXIT_CODE
