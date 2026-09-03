# GitHub connector push (no PC)

The Grok/ChatGPT GitHub connector cannot upload a single file much larger than **16 KB**.
Vercel and GitHub themselves accept bigger files. The limit is only this remote push channel.

## Rule

Keep every file that an agent must push under **16 000 bytes**.

If a screen grows past that:

1. Leave `page.tsx` as a 5-line re-export.
2. Split logic into sibling modules (`*-core.tsx`, `*-dialog.tsx`, `*-copy.ts`).
3. Run `node scripts/check-connector-limit.mjs`.
4. Push the small files one commit at a time.

Do not put the full Routes/Driver screen back into one `page.tsx`.

## Current Routes split

- `app/routes/page.tsx` — re-export only
- `app/routes/routes-screen.tsx` — list UI
- `app/routes/new-route-dialog.tsx` — New Route modal
- `app/routes/routes-workspace.tsx` — save / cards
- `app/routes/routes-workspace-core.tsx` — load / state
- `app/routes/routes-model.ts` + `routes-copy.ts` — types and copy
- `app/routes/new-route-ui.module.css` + `add-route-desktop.css` — visual tokens

## Restore Add Route without a PC

Push those modules to `ifitotech/routehub` `main`. Do not replace `page.tsx` with a 70 KB file.
