---
name: pr
description: Create a draft pull request for the current branch. Checks the branch state, runs `yarn ci`, writes an English description that follows .github/PULL_REQUEST_TEMPLATE.md, and opens a draft PR with the GitHub CLI. Use when the user asks to open, create, or draft a PR.
---

# Draft PR Creation

## Steps

1. **Pick the base branch**
   - Ask the user which base branch to target before doing anything else. Default to `master`; mention any other long-lived branches you see in `git branch -r` (e.g. `release/*`).

2. **Check the current state**
   - `git status` — stop and ask if there are uncommitted changes the user may want included
   - `git log --oneline {{base}}..HEAD` and `git diff {{base}}...HEAD --stat` — the commits and files unique to this branch
   - Confirm the branch is pushed (`git rev-parse --abbrev-ref --symbolic-full-name @{u}`); if not, ask before pushing

3. **Run the checks**
   - `yarn ci` (typecheck → format:check → eslint → stylelint → test). Do not open the PR while it fails; fix or report the failures first.
   - If the change touches the client (`app/`) or the socket protocol (`server/protocol.ts`, `server/sockets.ts`), also run `yarn e2e`.

4. **Write the description**
   - Read `.github/PULL_REQUEST_TEMPLATE.md` and fill in each section in English, based only on the commits unique to this branch
   - Keep HTML comments in the template as they are
   - Leave checklist boxes unchecked unless you actually ran that check in this session (e.g. tick `yarn ci` only if it passed above)
   - Under Evidence, include command output or screenshots you actually produced; never invent evidence

5. **Create the draft PR**

   ```bash
   gh pr create --draft --base {{base}} --title "<concise title>" --body-file <file>
   ```

   - Write the body to a temp file in the scratchpad rather than inlining it in the shell command
   - End the body with the attribution line the session's system reminder specifies, if any

6. **Report** the PR URL and any warnings.

## Rules

- Never include commits from branches merged into this one in the description — describe only `git log {{base}}..HEAD` minus merge commits
- Do not push, force-push, or change the base branch without asking
- Use the GitHub CLI (`gh`) for all GitHub operations
