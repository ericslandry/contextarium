---
name: feedback
description: Draft or file a bug report or improvement for the Contextarium plugin when requested.
argument-hint: "[file] [details]"
---

# Report Contextarium feedback

If the user gives no details, ask what they observed and what they expected. For a bug, capture steps to reproduce, expected and actual behavior, and the Contextarium or Copilot version if known. For an improvement, capture the use case and desired behavior. Preserve the user's observations and mark missing facts as unknown. Omit private conversation, repository data and diagnostics unless the user explicitly includes them for sharing.

Show the user a concise GitHub issue title and body. If they explicitly ask to file the issue, for example with `/contextarium:feedback file <details>`, use the available GitHub issue tool or authenticated `gh` in `ericslandry/contextarium` under Copilot's permissions. Return the issue URL once GitHub confirms creation. If filing is unavailable, provide the draft and the [new issue page](https://github.com/ericslandry/contextarium/issues/new). Keep the feedback in chat.
