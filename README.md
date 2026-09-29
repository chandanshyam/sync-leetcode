# sync-leetcode

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.0. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Refreshing auth

The daily workflow reads `LEETCODE_SESSION` and `LEETCODE_CSRF` from the repo's
Actions secrets. When the session expires, refresh those secrets with the Chrome
extension in [`extension/`](extension/README.md): log in to LeetCode and it
captures the cookies and pushes them to the secrets for you. (The old local
Playwright `refresh-auth` command has been removed.)
