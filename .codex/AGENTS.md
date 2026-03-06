# Project execution rules

When you make code changes:

1. Install dependencies only if needed.
2. Run the project locally after changes.
3. Run the relevant checks for the modified area.
4. Fix any immediate compile/lint/runtime issues before finishing.
5. Summarize exactly what changed and what commands were executed.

## Standard commands

### Frontend
- npm install
- npm run dev
- npm run build
- npm run lint

### Backend
- python -m venv .venv
- .venv\Scripts\activate
- pip install -r requirements.txt
- flask run

## Rule
After modifying files, automatically open the needed terminal(s) and execute the relevant startup/build/test commands for the affected app.
Do not ask for confirmation unless a command is destructive or leaves the workspace.