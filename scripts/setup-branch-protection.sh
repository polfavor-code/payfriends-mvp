#!/bin/bash

##############################################################################
# GitHub Branch Protection Setup Script
#
# This script configures branch protection rules for the main branch using
# the GitHub API.
#
# Requirements:
#   - GitHub Personal Access Token with 'repo' scope
#   - curl and jq installed
#
# Usage:
#   export GITHUB_TOKEN="your_personal_access_token"
#   ./scripts/setup-branch-protection.sh
#
# Or provide token as argument:
#   ./scripts/setup-branch-protection.sh "your_personal_access_token"
##############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Repository details
REPO_OWNER="polfavor-code"
REPO_NAME="payfriends-mvp"
BRANCH="main"

# Get token from argument or environment variable
TOKEN="${1:-$GITHUB_TOKEN}"

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Error: GitHub token not provided${NC}"
    echo "Usage:"
    echo "  export GITHUB_TOKEN='your_token'"
    echo "  $0"
    echo "Or:"
    echo "  $0 'your_token'"
    echo ""
    echo "Get a token at: https://github.com/settings/tokens"
    echo "Required scope: repo"
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}Warning: jq is not installed. Output will be raw JSON.${NC}"
    echo "Install jq for better output: sudo apt-get install jq"
    JQ_CMD="cat"
else
    JQ_CMD="jq"
fi

echo -e "${BLUE}Setting up branch protection for ${REPO_OWNER}/${REPO_NAME}:${BRANCH}${NC}"
echo ""

# GitHub API endpoint
API_URL="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/branches/${BRANCH}/protection"

# Branch protection configuration
# Note: required_status_checks is set to null since no CI/CD is configured yet
# When CI/CD is added, update this section with:
#   "required_status_checks": {
#     "strict": true,
#     "contexts": ["build", "lint", "test"]
#   }

read -r -d '' PROTECTION_CONFIG << 'EOF' || true
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
EOF

echo -e "${YELLOW}Applying branch protection rules...${NC}"
echo ""

# Make API request
HTTP_STATUS=$(curl -s -w "%{http_code}" -o /tmp/gh_response.json \
    -X PUT \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -d "$PROTECTION_CONFIG" \
    "$API_URL")

# Check response
if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 201 ]; then
    echo -e "${GREEN}✓ Branch protection successfully configured!${NC}"
    echo ""
    echo -e "${BLUE}Configuration applied:${NC}"
    echo "  ✓ Require pull request before merging"
    echo "  ✓ Require 1 approval"
    echo "  ✓ Dismiss stale approvals"
    echo "  ✓ Require conversation resolution"
    echo "  ✓ Require linear history"
    echo "  ✓ Include administrators in restrictions"
    echo "  ✓ Block force pushes"
    echo "  ✓ Block branch deletion"
    echo ""
    echo -e "${YELLOW}Note: Status checks not configured (no CI/CD yet)${NC}"
    echo "When CI/CD is added, update the script to include required checks."
    echo ""
    echo -e "${BLUE}Full response:${NC}"
    cat /tmp/gh_response.json | $JQ_CMD
else
    echo -e "${RED}✗ Failed to configure branch protection${NC}"
    echo "HTTP Status: $HTTP_STATUS"
    echo ""
    echo -e "${BLUE}Response:${NC}"
    cat /tmp/gh_response.json | $JQ_CMD
    echo ""

    if [ "$HTTP_STATUS" -eq 401 ]; then
        echo -e "${RED}Authentication failed. Check your token.${NC}"
    elif [ "$HTTP_STATUS" -eq 403 ]; then
        echo -e "${RED}Permission denied. Ensure your token has 'repo' scope.${NC}"
    elif [ "$HTTP_STATUS" -eq 404 ]; then
        echo -e "${RED}Repository or branch not found.${NC}"
    fi

    exit 1
fi

# Cleanup
rm -f /tmp/gh_response.json

echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Verify the settings at:"
echo "  https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/branches"
