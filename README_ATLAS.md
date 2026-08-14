# Atlas v1

Atlas is the new personal command-center layer around the existing Budget Tracker.

## Structure

- `/` — Atlas landing page
- `/dashboard/` — Atlas dashboard
- `/tools/budget-tracker/` — existing Budget Tracker
- `/atlas/` — assistant shell
- `/css/global.css` — shared Atlas styles
- `/js/supabase.js` — shared browser-safe Supabase configuration

## First milestone

The dashboard reads the existing `budgetTracker_transactions` localStorage backup and also attempts to read the `transactions` table from Supabase.

The Budget Tracker was moved without changing its internal functionality.

## Next phases

1. Tasks
2. Notes
3. Habits
4. Goals
5. Calendar
6. Authentication / Row Level Security review
7. Atlas AI tool-calling
