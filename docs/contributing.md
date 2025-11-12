# Contributing to PayFriends MVP

Thank you for your interest in contributing to PayFriends! This document outlines the development workflow and branch protection rules for this repository.

## Branch Protection Rules

The `main` branch is protected with the following rules to ensure code quality and stability:

### Required Settings

1. **Pull Request Required**
   - All changes to `main` must go through a pull request
   - Minimum of **1 approval** required before merging
   - Stale pull request approvals are automatically dismissed when new commits are pushed

2. **Conversation Resolution**
   - All conversations must be resolved before merging
   - Ensures all feedback and questions are addressed

3. **Linear History**
   - Merge commits are not allowed
   - Use squash merging or rebase to maintain a clean, linear history

4. **Status Checks** *(To be enabled when CI/CD is set up)*
   - When CI/CD workflows are added, required checks will include:
     - `build` - Ensure the application builds successfully
     - `lint` - Code style and quality checks
     - `test` - All tests must pass
   - Branches must be up to date with `main` before merging

5. **Push Restrictions**
   - Direct pushes to `main` are restricted to:
     - Repository administrators
     - Automated bots (for deployments/releases)

6. **Optional but Recommended**
   - Include administrators in restrictions (prevents accidental direct pushes)
   - Require signed commits (for enhanced security)

## Development Workflow

### 1. Create a Feature Branch

```bash
# Ensure you're on main and up to date
git checkout main
git pull origin main

# Create a new feature branch
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

- Write clean, well-documented code
- Follow existing code style and conventions
- Add tests for new functionality
- Update documentation as needed

### 3. Test Locally

Before opening a pull request, ensure your changes work:

```bash
# Install dependencies (if not already done)
npm install

# Run linting
npm run lint

# Run tests
npm test

# Test the application locally
npm start
```

### 4. Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with a descriptive message
git commit -m "Add: brief description of changes"
```

Use conventional commit prefixes:
- `Add:` for new features
- `Fix:` for bug fixes
- `Update:` for improvements to existing features
- `Refactor:` for code restructuring
- `Docs:` for documentation changes
- `Test:` for test additions/changes

### 5. Push and Create Pull Request

```bash
# Push your branch
git push -u origin feature/your-feature-name
```

Then:
1. Go to the repository on GitHub
2. Click "Compare & pull request"
3. Fill out the PR template with:
   - Clear description of changes
   - Why the changes are needed
   - How to test the changes
4. Request review from a maintainer
5. Address any feedback from reviewers

### 6. Merge

Once approved and all checks pass:
- A maintainer will merge your PR
- Your branch will be automatically deleted
- Changes will be deployed to the appropriate environment

## Code Review Guidelines

### For Contributors

- Respond to feedback promptly and professionally
- Don't take criticism personally - it's about the code, not you
- Ask questions if feedback is unclear
- Mark conversations as resolved once addressed

### For Reviewers

- Be constructive and specific in feedback
- Explain the "why" behind suggestions
- Approve promptly when changes look good
- Use GitHub's suggestion feature for small fixes

## Questions or Issues?

If you have questions or run into issues:
1. Check existing documentation
2. Search for similar issues in the repository
3. Open a new issue with a clear description
4. Tag relevant maintainers if urgent

## Setting Up Branch Protection

If you're a repository administrator setting up branch protection for the first time, use the script provided in `scripts/setup-branch-protection.sh` or follow the manual steps below.

### Manual Setup via GitHub UI

1. Go to **Settings → Branches** in the repository
2. Click **Add rule** under "Branch protection rules"
3. Configure as follows:
   - **Branch name pattern:** `main`
   - ✅ Require a pull request before merging
     - Required approvals: **1**
     - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require conversation resolution before merging
   - ✅ Require linear history
   - ✅ Do not allow bypassing the above settings (include administrators)
   - ✅ Restrict who can push to matching branches
     - Add only: administrators and deployment bots
   - Optional: ✅ Require signed commits
4. Click **Create** or **Save changes**

### Automated Setup via API

A script is provided at `scripts/setup-branch-protection.sh` that uses the GitHub API to configure branch protection. You'll need a GitHub personal access token with `repo` scope.

```bash
# Set your GitHub token
export GITHUB_TOKEN="your_personal_access_token"

# Run the setup script
./scripts/setup-branch-protection.sh
```

---

Thank you for contributing to PayFriends! 🚀
