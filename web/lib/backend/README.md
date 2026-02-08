# Backend Code for Serverless Functions

This directory contains backend logic that's been adapted to work in Vercel's serverless environment.

## Structure:
- `control/` - Job orchestration and management
- `execution/` - Agent execution logic
- `integrations/` - External service connectors (Google, Canva, etc.)
- `services/` - Business logic services
- `types/` - TypeScript type definitions

## Important Notes:
- All code here must be serverless-compatible (no long-running processes)
- Database connections use Supabase (serverless-friendly)
- No file system writes (use temp directories if needed)
- Keep cold start times minimal
