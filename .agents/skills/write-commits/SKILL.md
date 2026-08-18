---
name: write-commits
description: Create, review, or validate Git commit messages for this repository. Use when Codex is asked to commit changes, draft a commit message, review commit wording, enforce repo Git policy, or explain the required commit format.
---

# Write Commits

## Purpose

Use this skill to produce commit messages that match the repository Git
management policy and preserve useful history for future developers.

## Before Committing

- Inspect staged changes before writing the message.
- If no changes are staged, ask whether to stage files or only draft a message.
- Do not commit directly to `main`, `staging`, or `dev`.
- Confirm the current branch name is lowercase and hyphen-separated.
- Do not use `git commit -m` or any one-line commit flow.
- Use an editor, commit message file, or equivalent multi-line commit mechanism.

## Required Format

Every commit message must use this structure:

```text
{TicketNumber}: {brief description in imperative mood}

{Detail - justify design decisions / code structure / anything useful to future devs}
```

Rules:

- Include a ticket number at the start of the subject.
- Write the subject in imperative mood.
- Keep every line at or below 72 characters.
- Always include a body description.
- Use the body to explain useful context, especially design decisions, code
  structure, tradeoffs, migration notes, or future-dev rationale.
- Avoid vague history such as `Add feature 1`, `Fix feature 1`, or
  `Actually fix feature 1`.

The imperative subject should fit this sentence:

```text
If this commit is merged, it will {brief description}.
```

## Drafting Workflow

1. Read the staged diff with `git diff --cached`.
2. Identify the ticket number from the branch name, user request, issue context,
   or existing conventions. If unavailable, ask for it before committing.
3. Summarize the change as a concise imperative subject.
4. Write a body that explains why the change is shaped this way, not just what
   files changed.
5. Check all lines are 72 characters or shorter.
6. Commit with a multi-line message file, for example:

```bash
git commit --file /tmp/commit-message.txt
```

## Amendments

- If the commit has not been pushed or shared, prefer amending to fix issues so
  history stays clean and reverts remain easy.
- Do not run `git commit --amend` for pushed commits.

## Merging Expectations

- Require reviewer approval before merging.
- Treat reviewer approval as shared responsibility for the change.
- Ask substantive review questions as comments, including high-level design
  questions, not only typo-level feedback.
- Ensure CI checks, including linting and tests, pass before merge.
- Delete the feature branch after merging.

## Prohibited Commands

Do not run these commands:

- `git push --force`
- `git rebase <shared-branch>`
- `git commit --amend` for pushed commits
- `git push --mirror`
