@AGENTS.md

## Deployment

Vercel auto-deploys from erlecohen-rgb/slobs-fantasy on push to main. To deploy changes live to production:
1. Commit and push changes to main on erlecohen-rgb/slobs-fantasy
2. Vercel auto-deploys on push

## App Overview

This is a Next.js fantasy baseball app (SLOBS league). Key structure:
- src/app/ — pages and API routes
- src/components/ — React components
- src/lib/ — utilities (database, MLB API, scoring logic)
- supabase-schema.sql — database schema

Hosted on Vercel. Database is Supabase. Auth is Clerk. MLB data comes from the MLB Stats API.
