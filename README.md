# Handover IQ — Project Intelligence, Evidence, Handover

This build preserves the Knowledge Sources and Evidence Explorer (Module 3) and adds:

- **Module 2 — AI Project Intelligence:** Groq-powered structured extraction of project overview, decisions, responsibilities, completed/pending tasks, dependencies, blockers, risks, unresolved questions and recommendations. AI citations are accepted only when the returned source ID exists and the quoted excerpt exactly occurs in that stored chunk.
- **Module 4 — Smart Handover Generator:** role-aware handover generation from stored intelligence records.
- **Module 5 — Review, Approval and PDF Export:** editable JSON report, versioned drafts, request-changes/approve actions and PDF export restricted to approved handovers.

## Requirements
- Python 3.10+
- Node.js 18+
- A Groq API key for live AI generation

## Backend setup (PowerShell)
```powershell
cd .\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item ..\.env.example .env
```
Edit `backend/.env` and set your key:
```env
GROQ_API_KEY=gsk_your_real_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```
Then run:
```powershell
uvicorn main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

## Frontend setup (second terminal)
```powershell
cd .\nexus-ai-frontend
npm install
npm run dev
```
Open the Vite URL (usually http://localhost:5173).

## Suggested demo flow
1. Knowledge Sources → upload meeting notes / requirements / project documents.
2. Evidence Explorer → inspect and review evidence-linked claims (Module 3).
3. AI Intelligence & Handover → Project Intelligence → Analyze project sources (Module 2).
4. Handover Generator → enter departing member, incoming member and role → Generate (Module 4).
5. Review & Approval → edit the report JSON if needed → Save edited draft → Approve version → Export approved PDF (Module 5).

## API endpoints added
- `POST /api/intelligence/analyze`
- `GET /api/intelligence`
- `POST /api/handovers/generate`
- `GET /api/handovers`
- `GET /api/handovers/{id}`
- `PUT /api/handovers/{id}`
- `POST /api/handovers/{id}/approve`
- `POST /api/handovers/{id}/request-changes`
- `GET /api/handovers/{id}/export.pdf`

## Important notes
- This MVP uses SQLite in `backend/nexus_sources.db`, matching the current project. It does not silently migrate to PostgreSQL.
- No Groq key is included. Never commit or share your real API key.
- AI output is not automatically considered verified. Module 3 remains the human evidence-review step.
- PDF export returns HTTP 403 until the selected handover is approved.
- The current frontend workspace uses the demo project ID `nexus-demo-project`, consistent with the existing Knowledge Sources and Evidence Explorer components.


## Authentication and shared team workspaces

- Register with an email, password (8+ characters), and a team/workspace name. The first user becomes the team owner.
- Share the invitation code shown after registration. Teammates sign in and enter that code in the optional invitation-code field to join the same workspace.
- Team members use the same project ID and see the same sources, evidence, intelligence and handovers. Other teams have separate project IDs and are rejected by the API.
- Set `NEXUS_AUTH_SECRET` to a long random secret in `backend/.env` before using outside a local demo.
- Groq is separate from authentication: configure `GROQ_API_KEY` in `backend/.env` for AI analysis and handover generation.
- Google OAuth and password-reset email are not configured in this MVP.

Example `backend/.env`:
```env
NEXUS_AUTH_SECRET=replace-with-a-long-random-secret
GROQ_API_KEY=your-groq-key
GROQ_MODEL=llama-3.3-70b-versatile
```
