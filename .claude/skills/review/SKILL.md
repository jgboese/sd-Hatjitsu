---
name: review
description: Multi-agent debate code review. Spawns a panel of focused reviewers in parallel, has them verify findings against the codebase, cross-examine each other, then synthesizes one reconciled verdict. Can post validated non-blocking comments to GitHub after you confirm. Pass "quick" for a single-pass review.
---

# Code Review Skill

## Step 1: Gather PR Details

1. Get the current branch name
2. Run `gh pr view --json title,body,number,url,baseRefName,headRefName,commits` to get PR details. If there is no PR for the branch, review the branch against `master` instead.
3. Run `git diff {{baseRefName}}...HEAD` to get ONLY commits unique to this branch
4. Read existing review comments on the PR (`gh pr view --comments` and `gh api repos/{owner}/{repo}/pulls/{number}/comments`)

## Step 2: Mode Selection

- If the skill argument contains `quick`: skip Steps 3–4 and produce the review directly yourself (single pass) using the output format in Step 5. Use this for trivial PRs.
- Otherwise: run the debate flow (Steps 3–5).

## Step 3: Parallel Reviewer Panel (debate mode)

Spawn the following 4 reviewer agents **in parallel in a single message** (Agent tool, `subagent_type: general-purpose`). Each reviewer's prompt must include:

- The PR number, branch, and base ref, with instructions to run `git diff {{baseRefName}}...HEAD` and `gh pr view` itself
- "Review ONLY changes unique to this branch — ignore anything merged in from master. Do NOT modify any files; you are read-only."
- The reviewer's focus charter (below). Tell it to stay in its lane — other reviewers cover the other dimensions.
- A one-paragraph summary of what the PR is supposed to do (from the PR body and commits)
- A verification mandate (state this explicitly in every reviewer prompt): VERIFY each finding against the actual codebase, not the diff alone. For "this breaks X" claims, grep the real callers/usages; for convention claims, open CLAUDE.md and the cited file; for behavior claims, read the surrounding code. Do not report speculative nits — if you could not confirm it against real code, drop it (or report it as confidence: low and say exactly what you could not verify).
- The required output format, one line per finding:

  `severity (blocker/major/minor/nit) | file:line | claim | evidence (cite the actual code) | confidence (high/med/low)`

  "No findings" is an acceptable answer — do not pad with filler findings.

Focus charters:

1. Correctness & edge cases — logic bugs, error handling, null/undefined handling, off-by-one errors in the changed code. Async and socket races: events arriving before `connect`/`join room`, reconnects that reuse a `sessionId` with a new `socket.id`, listeners registered on every room entry, acknowledgements that are never called. Client/server protocol compatibility: any change to an event name, payload field, acknowledgement shape, or broadcast in `server/protocol.ts` / `server/sockets.ts` must still match what `client/src/socket.ts` and `client/src/useRoom.ts` send and expect (and vice versa); the shared types catch most of this, but not changed semantics. React: effects that subscribe without cleaning up, stale closures over room state, optimistic local updates in `useRoom.ts` that no longer mirror what the server does, missing or unstable `key`s.
2. Project conventions — tell the agent to read CLAUDE.md first. TypeScript must be erasable-only (no `enum`, no parameter properties, no `namespace`) and import local modules with their `.ts`/`.tsx` extension, because Node runs the server with native type stripping (the client follows the same rules). Type-only imports use `import type`; the client imports only types from `server/`. Markup and class names in the client stay stable, because `client/src/app.css` and the e2e locators depend on them. New client→server events get a zod schema in `server/protocol.ts` and are registered through the handler table in `server/sockets.ts`; new server→client broadcasts are added to `ServerToClientEvents`. Room/Lobby stay pure state (no socket access). Exported functions, classes, interfaces and type aliases need JSDoc. Lint/format rules come from `eslint.config.js`, `.prettierrc`, `.stylelintrc` — only flag a style issue if the tooling or CLAUDE.md actually requires it.
3. Performance & blast radius — look outward from the diff: grep for callers of changed functions, other users of changed protocol events, and the client code paths that react to a changed broadcast. Broadcast fan-out: every broadcast makes each client in the room re-request `room info`, so extra or `io.to()` (instead of `socket.to()`) broadcasts multiply traffic. Memory growth: rooms and connections live in memory for the life of the process — check that new state is cleaned up (empty-room pruning in `Lobby.createRoom`, `Room.leave`). Client: socket handlers registered per room visit, re-renders or effects that run on every render, timers that are not cleared, bundle size from new client dependencies.
4. Security — socket payloads come from untrusted clients: every new event must be validated with zod and must not be able to throw inside a handler (an uncaught throw crashes the whole process). `sessionId` is a client-supplied cookie value that the server trusts as identity; flag changes that widen what one client can do to another's seat. Admin rights are a client-side cookie only — flag anything that assumes the server enforces them. XSS in the client (`dangerouslySetInnerHTML`, building HTML strings, user input in `href`s). Data exposed via `/debug_state` (it is public and includes session IDs). Risky dependency changes in `package.json` / `yarn.lock`.

## Step 4: Cross-Examination Round (debate mode, one round only)

1. Compile a numbered digest of every finding from Step 3, attributed by reviewer (e.g. "F1 [correctness] major server/sockets.ts:42: claim — evidence").
2. If there is ≤ 1 finding in total, or every finding is a nit, skip this step and go to Step 5.
3. Otherwise, use SendMessage to continue each reviewer that produced findings — and any reviewer whose domain another reviewer's finding touches — **in parallel**, with:
   - The full digest of the other reviewers' findings
   - Instructions to:
     a. Re-examine each of its OWN findings against the peers' evidence — mark each one confirm / revise / withdraw, with a one-line reason
     b. Flag any PEER finding it believes is wrong, citing the actual code that refutes it
     c. Return its updated finding list in the same one-line format
4. Run exactly one cross-examination round — do not loop until consensus.
5. Fallback: if SendMessage is unavailable in this session, instead spawn one fresh verifier agent per non-nit finding, prompted to refute it ("Adversarially verify this claim against the code; default to refuted if the evidence doesn't hold up").

## Step 5: Synthesize the Final Review

Merge the post-cross-exam findings yourself:

- Drop withdrawn findings
- Dedupe overlapping findings: keep the higher severity, and note when multiple reviewers independently agreed (agreement is high signal — say so)
- Validate every nit against CLAUDE.md and the lint configs: drop any nit that does not map to a documented project convention (a personal style preference the project does not actually require is not a finding)
- Findings still disputed after cross-exam go in a "Contested" subsection with both positions, one line each — report them, don't drop them

Output the review in this structure:

### Overview

- What this PR does (1-2 sentences)

### Code Review

- Confirmed findings ordered by severity (blocker → nit), each with file:line and which reviewer(s) raised it
- Contested: disputed findings with both positions, one line each

### Merge Verdict

- LGTM / Needs Changes / Needs Discussion

## Step 6: Post Non-Blocking Comments to GitHub (only after you confirm)

Posting is opt-in. The written review (Step 5) is the default deliverable — do NOT post, comment, commit, or change any code automatically.

1. After presenting the review, list the comments you propose to post: one per confirmed finding (skip Contested and withdrawn findings), each as `file:line` plus the draft comment text — concise English, non-blocking tone.
2. Ask the user to confirm. Post only what they approve; if they decline, stop here.
3. Post as non-blocking comments only: inline review comments via `gh api repos/{owner}/{repo}/pulls/{number}/comments` with `commit_id`, `path`, and `line` per finding (or a single `gh pr review --comment` summary). Never use `--request-changes` or `--approve`, and never submit a blocking review.
4. Take no action beyond posting these comments (no code fixes, commits, or follow-up runs) unless the user separately confirms.

## Important

- Scope discipline: this skill's job is to review, and — only on confirmation — post non-blocking comments. Do NOT make code changes, commits, or any other action beyond that unless the user explicitly asks.
- Do NOT include changes merged in from master in the review
- Reviewer agents are read-only — they must never edit files, commit, or comment on the PR
- Debate mode spawns ~4–8 agents and costs meaningfully more than `quick` mode; suggest `quick` if the diff is a handful of lines
