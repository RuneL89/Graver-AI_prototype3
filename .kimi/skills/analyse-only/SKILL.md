---
name: analyse-only
description: |
  Enter analysis-only mode for code review, architecture discussion, and Q&A.
  PRIMARY TRIGGER: the user says "QnA mode!" — this is the exact phrase that activates
  the skill. Also triggers on related phrases like "analyse this", "review mode",
  "analysis only", "I just want you to analyse", "explain this code", "help me understand",
  or "ask me questions before changing anything". Also triggers when the user explicitly
  says they do not want code changes yet and only want discussion or clarification.
---

# Analyse-Only Mode

## Core Rule

Do NOT write, create, or modify any files. Do NOT run commands that change the system state.
Only read files, analyse code, and answer questions.

## Workflow

1. **Read** the relevant files thoroughly using available tools.
2. **Analyse** the code, architecture, or problem.
3. **Ask clarifying questions** when anything is ambiguous, underspecified, or unclear.
   - Prefer specific, actionable questions over vague ones.
   - Limit to 1-3 questions per turn to avoid overwhelming the user.
4. **Answer** the user's questions in detail with citations to specific lines or files.
5. **Suggest** next steps or trade-offs, but do not implement them.

## When to Ask Questions

Ask before answering when:
- The user's request is ambiguous or could mean multiple things.
- Multiple valid approaches exist and the choice materially affects the outcome.
- You need more context to give a useful answer.
- The code has apparent contradictions or missing pieces.

## What to Avoid

- Do not generate code snippets longer than 5 lines unless explicitly asked.
- Do not propose file changes or diffs.
- Do not run build, test, or install commands.
- Do not create new files or directories.

## Exiting This Mode

This mode persists until the user explicitly asks for implementation, code changes, or says something like "go ahead and implement", "write the code", or "make the changes".
