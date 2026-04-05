@AGENTS.md

## Deployment

This is a fork of wynot/slobs-fantasy. To deploy changes live to production:
1. Commit changes to this fork
2. Open a PR from this fork to wynot/slobs-fantasy (the upstream repo)
3. Merge the PR immediately — no approval needed
4. Vercel auto-deploys from wynot/slobs-fantasy on merge

IMPORTANT: Always follow this process after making changes. Never just commit to the fork — changes won't go live until they're
merged upstream.

## App Overview

This is a Next.js fantasy baseball app (SLOBS league). Key structure:
- src/app/ — pages and API routes
- src/components/ — React components
- src/lib/ — utilities (database, MLB API, scoring logic)
- supabase-schema.sql — database schema

Hosted on Vercel. Database is Supabase. Auth is Clerk. MLB data comes from the MLB Stats API.
