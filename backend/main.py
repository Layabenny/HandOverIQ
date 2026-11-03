from __future__ import annotations

import csv
import io
import json
import os
import re
import sqlite3
import uuid
import base64
import hashlib
import hmac
import time
from openpyxl import load_workbook
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fitz
from docx import Document
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
DB_PATH = BASE_DIR / "nexus_sources.db"
MAX_BYTES = 25 * 1024 * 1024
ALLOWED = {"pdf", "docx", "txt", "md", "csv", "xlsx", "json"}

app = FastAPI(title="Handover IQ Knowledge Ingestion API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    with db() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS sources (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL, filename TEXT NOT NULL,
            category TEXT NOT NULL, uploaded_at TEXT NOT NULL, access_scope TEXT NOT NULL,
            stored_path TEXT, status TEXT NOT NULL, page_count INTEGER DEFAULT 0
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY, source_id TEXT NOT NULL, project_id TEXT NOT NULL,
            filename TEXT NOT NULL, page_or_section TEXT, chunk_index INTEGER NOT NULL,
            original_text TEXT NOT NULL, uploaded_at TEXT NOT NULL, access_scope TEXT NOT NULL,
            FOREIGN KEY(source_id) REFERENCES sources(id)
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS claims (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL, claim TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'Project status',
            status TEXT NOT NULL DEFAULT 'needs_verification',
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS claim_evidence (
            claim_id TEXT NOT NULL, chunk_id TEXT NOT NULL,
            PRIMARY KEY(claim_id, chunk_id),
            FOREIGN KEY(claim_id) REFERENCES claims(id),
            FOREIGN KEY(chunk_id) REFERENCES chunks(id)
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS claim_reviews (
            id TEXT PRIMARY KEY, claim_id TEXT NOT NULL, action TEXT NOT NULL,
            comment TEXT, reviewer TEXT NOT NULL, created_at TEXT NOT NULL
        )""")

init_db()


# Multi-tenant authentication and workspace tables
AUTH_SECRET = os.getenv("NEXUS_AUTH_SECRET", "CHANGE_THIS_SECRET_BEFORE_DEPLOYMENT")

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def make_token(user_id: str) -> str:
    header = b64url(json.dumps({"alg":"HS256","typ":"JWT"}).encode())
    payload = b64url(json.dumps({"sub":user_id,"exp":int(time.time())+60*60*24*7}).encode())
    signing = f"{header}.{payload}"
    sig = b64url(hmac.new(AUTH_SECRET.encode(), signing.encode(), hashlib.sha256).digest())
    return f"{signing}.{sig}"

def read_token(token: str) -> str | None:
    try:
        h, p, sig = token.split(".")
        signing = f"{h}.{p}"
        expected = b64url(hmac.new(AUTH_SECRET.encode(), signing.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected): return None
        payload = json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
        if payload.get("exp", 0) < time.time(): return None
        return str(payload["sub"])
    except Exception:
        return None

def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{base64.b64encode(salt).decode()}:{base64.b64encode(digest).decode()}"

def verify_password(password: str, encoded: str) -> bool:
    try:
        salt_b64, digest_b64 = encoded.split(":", 1)
        return hmac.compare_digest(hash_password(password, base64.b64decode(salt_b64)).split(":",1)[1], digest_b64)
    except Exception: return False

with db() as conn:
    conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)")
    conn.execute("CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL)")
    conn.execute("CREATE TABLE IF NOT EXISTS memberships (user_id TEXT NOT NULL, team_id TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY(user_id,team_id), FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(team_id) REFERENCES teams(id))")
    conn.execute("CREATE TABLE IF NOT EXISTS team_projects (project_id TEXT PRIMARY KEY, team_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, FOREIGN KEY(team_id) REFERENCES teams(id))")

class RegisterPayload(BaseModel):
    email: str
    password: str
    team_name: str

class LoginPayload(BaseModel):
    email: str
    password: str

class JoinTeamPayload(BaseModel):
    invite_code: str


def memberships_for(user_id: str):
    with db() as conn:
        rows = conn.execute("""SELECT t.id AS team_id,t.name,t.invite_code,p.project_id,m.role
            FROM memberships m JOIN teams t ON t.id=m.team_id
            JOIN team_projects p ON p.team_id=t.id WHERE m.user_id=? ORDER BY t.name""", (user_id,)).fetchall()
    return [dict(r) for r in rows]

@app.post("/api/auth/register")
def register(payload: RegisterPayload):
    email = payload.email.strip().lower()
    if "@" not in email or len(email) > 254: raise HTTPException(400, "Enter a valid email address.")
    if len(payload.password) < 8: raise HTTPException(400, "Password must contain at least 8 characters.")
    if not payload.team_name.strip(): raise HTTPException(400, "Team/workspace name is required.")
    user_id, team_id, project_id = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
    now, invite = datetime.now(timezone.utc).isoformat(), uuid.uuid4().hex[:8].upper()
    try:
        with db() as conn:
            conn.execute("INSERT INTO users VALUES (?,?,?,?)", (user_id,email,hash_password(payload.password),now))
            conn.execute("INSERT INTO teams VALUES (?,?,?,?)", (team_id,payload.team_name.strip(),invite,now))
            conn.execute("INSERT INTO memberships VALUES (?,?,?)", (user_id,team_id,"owner"))
            conn.execute("INSERT INTO team_projects VALUES (?,?,?)", (project_id,team_id,payload.team_name.strip()+" Project"))
    except sqlite3.IntegrityError:
        raise HTTPException(409, "An account with this email already exists. Please sign in.")
    return {"access_token":make_token(user_id),"token_type":"bearer","user":{"id":user_id,"email":email},"teams":memberships_for(user_id)}

@app.post("/api/auth/login")
def login(payload: LoginPayload):
    with db() as conn:
        user = conn.execute("SELECT * FROM users WHERE email=?", (payload.email.strip().lower(),)).fetchone()
    if not user or not verify_password(payload.password,user["password_hash"]):
        raise HTTPException(401, "Incorrect email or password.")
    return {"access_token":make_token(user["id"]),"token_type":"bearer","user":{"id":user["id"],"email":user["email"]},"teams":memberships_for(user["id"])}

@app.get("/api/auth/me")
def auth_me(request: Request):
    auth = request.headers.get("authorization", "")
    user_id = read_token(auth[7:]) if auth.lower().startswith("bearer ") else None
    if not user_id: raise HTTPException(401,"Authentication required.")
    with db() as conn: user=conn.execute("SELECT id,email FROM users WHERE id=?",(user_id,)).fetchone()
    if not user: raise HTTPException(401,"User account not found.")
    return {"user":dict(user),"teams":memberships_for(user_id)}

@app.post("/api/teams/join")
def join_team(payload: JoinTeamPayload, request: Request):
    auth=request.headers.get("authorization",""); user_id=read_token(auth[7:]) if auth.lower().startswith("bearer ") else None
    if not user_id: raise HTTPException(401,"Authentication required.")
    with db() as conn:
        team=conn.execute("SELECT * FROM teams WHERE invite_code=?",(payload.invite_code.strip().upper(),)).fetchone()
        if not team: raise HTTPException(404,"Invitation code not found.")
        conn.execute("INSERT OR IGNORE INTO memberships VALUES (?,?,?)",(user_id,team["id"],"member"))
    return {"teams":memberships_for(user_id)}

@app.middleware("http")
async def enforce_team_access(request: Request, call_next):

    # Allow browser CORS preflight requests
    if request.method == "OPTIONS":
        return await call_next(request)

    # Protect project APIs
    if (
        request.url.path.startswith("/api/")
        and not request.url.path.startswith("/api/auth/")
        and request.url.path != "/api/teams/join"
    ):
        auth = request.headers.get("authorization", "")

        user_id = (
            read_token(auth[7:])
            if auth.lower().startswith("bearer ")
            else None
        )

        if not user_id:
            return JSONResponse(
                status_code=401,
                content={"detail": "Please sign in to access this workspace."}
            )

        project_id = (
            request.headers.get("x-project-id")
            or request.query_params.get("project_id")
        )

        if not project_id:
            return JSONResponse(
                status_code=400,
                content={"detail": "X-Project-ID header is required."}
            )

        with db() as conn:
            allowed = conn.execute(
                """
                SELECT 1
                FROM team_projects p
                JOIN memberships m ON m.team_id = p.team_id
                WHERE p.project_id = ? AND m.user_id = ?
                """,
                (project_id, user_id)
            ).fetchone()

        if not allowed:
            return JSONResponse(
                status_code=403,
                content={"detail": "You do not have access to this team's project."}
            )

    return await call_next(request)

def split_chunks(text: str, max_chars: int = 1200, overlap: int = 150) -> list[str]:
    clean = re.sub(r"\s+", " ", text).strip()
    if not clean:
        return []
    chunks, start = [], 0
    while start < len(clean):
        end = min(start + max_chars, len(clean))
        if end < len(clean):
            boundary = clean.rfind(" ", start, end)
            if boundary > start + max_chars // 2:
                end = boundary
        chunks.append(clean[start:end].strip())
        if end >= len(clean):
            break
        start = max(end - overlap, start + 1)
    return [x for x in chunks if x]

def extract_content(filename: str, raw: bytes) -> tuple[list[tuple[str, str]], int]:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "pdf":
        doc = fitz.open(stream=raw, filetype="pdf")
        pages = [(f"Page {i + 1}", page.get_text("text")) for i, page in enumerate(doc)]
        return pages, len(doc)
    if ext == "docx":
        document = Document(io.BytesIO(raw))
        text = "\n".join(p.text for p in document.paragraphs if p.text.strip())
        for table in document.tables:
            text += "\n" + "\n".join(" | ".join(cell.text for cell in row.cells) for row in table.rows)
        return [("Document", text)], 0
    if ext in {"txt", "md"}:
        return [("Document", raw.decode("utf-8-sig", errors="replace"))], 0
    if ext == "csv":
        rows = list(csv.reader(io.StringIO(raw.decode("utf-8-sig", errors="replace"))))
        return [("CSV", "\n".join(" | ".join(row) for row in rows))], 0
    if ext == "xlsx":
        workbook = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        sheets = []
        for sheet in workbook.worksheets:
            lines = []
            for row in sheet.iter_rows(values_only=True):
                lines.append(" | ".join("" if value is None else str(value) for value in row))
            sheets.append((f"Sheet: {sheet.title}", "\\n".join(lines)))
        return sheets, 0
    if ext == "json":
        obj = json.loads(raw.decode("utf-8-sig"))
        return [("JSON", json.dumps(obj, ensure_ascii=False, indent=2))], 0
    raise HTTPException(status_code=415, detail="Supported formats: PDF, DOCX, TXT, MD, CSV and JSON.")

def store_source(project_id: str, filename: str, category: str, raw_text: list[tuple[str, str]],
                 stored_path: str | None = None, page_count: int = 0) -> dict[str, Any]:
    source_id = str(uuid.uuid4())
    uploaded_at = datetime.now(timezone.utc).isoformat()
    access_scope = "workspace"
    all_chunks = []
    for section, text in raw_text:
        for idx, chunk in enumerate(split_chunks(text)):
            all_chunks.append((str(uuid.uuid4()), source_id, project_id, filename, section,
                               idx, chunk, uploaded_at, access_scope))
    with db() as conn:
        conn.execute("""INSERT INTO sources
            (id, project_id, filename, category, uploaded_at, access_scope, stored_path, status, page_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (source_id, project_id, filename, category, uploaded_at, access_scope,
             stored_path, "processed", page_count))
        conn.executemany("""INSERT INTO chunks
            (id, source_id, project_id, filename, page_or_section, chunk_index, original_text, uploaded_at, access_scope)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""", all_chunks)
    return {"id": source_id, "filename": filename, "status": "processed",
            "chunks_created": len(all_chunks), "pages": page_count,
            "message": f"Extracted and stored {len(all_chunks)} traceable text chunks."}

@app.get("/health")
def health():
    return {"status": "ok", "service": "Handover IQ Knowledge Ingestion"}

@app.post("/api/sources/upload")
async def upload_source(
    file: UploadFile = File(...),
    category: str = Form("Project documentation"),
    project_id: str = Form("nexus-demo-project"),
):
    filename = Path(file.filename or "upload").name
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED:
        raise HTTPException(status_code=415, detail="Unsupported file type.")
    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 25 MB.")
    try:
        extracted, pages = extract_content(filename, raw)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not parse file: {exc}") from exc
    safe_name = f"{uuid.uuid4()}_{filename}"
    destination = UPLOAD_DIR / safe_name
    destination.write_bytes(raw)
    try:
        result = store_source(project_id, filename, category, extracted, str(destination), pages)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    return result

class TextSource(BaseModel):
    title: str
    content: str
    category: str = "Meeting minutes"
    project_id: str = "nexus-demo-project"

@app.post("/api/sources/text")
def add_text(payload: TextSource):
    if not payload.title.strip() or not payload.content.strip():
        raise HTTPException(status_code=400, detail="Title and content are required.")
    result = store_source(payload.project_id, f"{payload.title.strip()}.txt",
                          payload.category, [("Manual entry", payload.content)])
    return result

@app.get("/api/sources")
def list_sources(project_id: str = "nexus-demo-project"):
    with db() as conn:
        rows = conn.execute("""SELECT s.*, COUNT(c.id) AS chunk_count FROM sources s
            LEFT JOIN chunks c ON c.source_id = s.id
            WHERE s.project_id = ? GROUP BY s.id ORDER BY s.uploaded_at DESC""", (project_id,)).fetchall()
    return {"sources": [dict(row) for row in rows]}

@app.get("/api/sources/{source_id}/chunks")
def get_source_chunks(source_id: str, project_id: str = "nexus-demo-project"):
    with db() as conn:
        rows = conn.execute("""SELECT id, filename, page_or_section, chunk_index,
            original_text, uploaded_at, access_scope FROM chunks
            WHERE source_id = ? AND project_id = ? ORDER BY chunk_index""",
            (source_id, project_id)).fetchall()
    if not rows:
        raise HTTPException(status_code=404, detail="Source or chunks not found.")
    return {"chunks": [dict(row) for row in rows]}


class ClaimCreate(BaseModel):
    project_id: str = "nexus-demo-project"
    claim: str
    category: str = "Project status"
    evidence_ids: list[str] = []

class ClaimUpdate(BaseModel):
    claim: str
    category: str = "Project status"
    evidence_ids: list[str] = []

class ClaimReview(BaseModel):
    action: str
    comment: str = ""
    reviewer: str = "Workspace Admin"

def claim_payload(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    evidence = conn.execute("""SELECT c.id AS chunk_id, c.filename, c.page_or_section,
        c.original_text, c.source_id FROM claim_evidence ce
        JOIN chunks c ON c.id = ce.chunk_id WHERE ce.claim_id = ?
        ORDER BY c.filename, c.chunk_index""", (row["id"],)).fetchall()
    reviews = conn.execute("""SELECT action, comment, reviewer, created_at
        FROM claim_reviews WHERE claim_id = ? ORDER BY created_at DESC""",
        (row["id"],)).fetchall()
    return {**dict(row), "evidence": [dict(x) for x in evidence],
            "reviews": [dict(x) for x in reviews]}

def validate_evidence(conn: sqlite3.Connection, project_id: str, evidence_ids: list[str]):
    if not evidence_ids:
        return
    placeholders = ",".join("?" for _ in evidence_ids)
    rows = conn.execute(f"""SELECT id FROM chunks WHERE project_id = ?
        AND id IN ({placeholders})""", [project_id, *evidence_ids]).fetchall()
    found = {r["id"] for r in rows}
    missing = sorted(set(evidence_ids) - found)
    if missing:
        raise HTTPException(status_code=400, detail="Unknown evidence IDs: " + ", ".join(missing))

@app.get("/api/evidence")
def list_evidence(project_id: str = "nexus-demo-project", q: str = ""):
    with db() as conn:
        rows = conn.execute("""SELECT c.id AS chunk_id, c.source_id, c.filename,
            c.page_or_section, c.original_text, c.chunk_index
            FROM chunks c WHERE c.project_id = ? AND
            (? = '' OR c.filename LIKE ? OR c.original_text LIKE ?)
            ORDER BY c.filename, c.page_or_section, c.chunk_index""",
            (project_id, q, f"%{q}%", f"%{q}%")).fetchall()
    return {"evidence": [dict(r) for r in rows]}

@app.get("/api/claims")
def list_claims(project_id: str = "nexus-demo-project"):
    with db() as conn:
        rows = conn.execute("""SELECT * FROM claims WHERE project_id = ?
            ORDER BY updated_at DESC""", (project_id,)).fetchall()
        return {"claims": [claim_payload(conn, r) for r in rows]}

@app.post("/api/claims")
def create_claim(payload: ClaimCreate):
    if not payload.claim.strip():
        raise HTTPException(status_code=400, detail="Claim text is required.")
    claim_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        validate_evidence(conn, payload.project_id, payload.evidence_ids)
        conn.execute("""INSERT INTO claims
            (id, project_id, claim, category, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (claim_id, payload.project_id, payload.claim.strip(), payload.category,
             "needs_verification" if payload.evidence_ids else "missing_evidence", now, now))
        conn.executemany("INSERT INTO claim_evidence (claim_id, chunk_id) VALUES (?, ?)",
                         [(claim_id, x) for x in dict.fromkeys(payload.evidence_ids)])
        row = conn.execute("SELECT * FROM claims WHERE id = ?", (claim_id,)).fetchone()
        return claim_payload(conn, row)

@app.put("/api/claims/{claim_id}")
def update_claim(claim_id: str, payload: ClaimUpdate):
    if not payload.claim.strip():
        raise HTTPException(status_code=400, detail="Claim text is required.")
    now = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        row = conn.execute("SELECT * FROM claims WHERE id = ?", (claim_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Claim not found.")
        validate_evidence(conn, row["project_id"], payload.evidence_ids)
        conn.execute("UPDATE claims SET claim=?, category=?, status=?, updated_at=? WHERE id=?",
            (payload.claim.strip(), payload.category,
             "needs_verification" if payload.evidence_ids else "missing_evidence", now, claim_id))
        conn.execute("DELETE FROM claim_evidence WHERE claim_id = ?", (claim_id,))
        conn.executemany("INSERT INTO claim_evidence (claim_id, chunk_id) VALUES (?, ?)",
                         [(claim_id, x) for x in dict.fromkeys(payload.evidence_ids)])
        row = conn.execute("SELECT * FROM claims WHERE id = ?", (claim_id,)).fetchone()
        return claim_payload(conn, row)

@app.post("/api/claims/{claim_id}/review")
def review_claim(claim_id: str, payload: ClaimReview):
    action = payload.action.lower()
    if action not in {"verify", "reject", "conflicting"}:
        raise HTTPException(status_code=400, detail="Action must be verify, reject or conflicting.")
    now = datetime.now(timezone.utc).isoformat()
    status = {"verify": "verified", "reject": "rejected", "conflicting": "conflicting"}[action]
    with db() as conn:
        row = conn.execute("SELECT * FROM claims WHERE id = ?", (claim_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Claim not found.")
        if action == "verify":
            count = conn.execute("SELECT COUNT(*) FROM claim_evidence WHERE claim_id=?", (claim_id,)).fetchone()[0]
            if not count:
                raise HTTPException(status_code=400, detail="A claim needs supporting evidence before it can be verified.")
        conn.execute("UPDATE claims SET status=?, updated_at=? WHERE id=?", (status, now, claim_id))
        conn.execute("""INSERT INTO claim_reviews (id, claim_id, action, comment, reviewer, created_at)
            VALUES (?, ?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), claim_id, action, payload.comment, payload.reviewer, now))
        row = conn.execute("SELECT * FROM claims WHERE id = ?", (claim_id,)).fetchone()
        return claim_payload(conn, row)

# ---------------------------------------------------------------------------
# Module 2: AI Project Intelligence Engine
# Module 4: Role-aware Smart Handover
# Module 5: Review, approval, version history and PDF export
# ---------------------------------------------------------------------------

class IntelligenceRun(BaseModel):
    project_id: str = "nexus-demo-project"
    source_ids: list[str] = []

class HandoverRequest(BaseModel):
    project_id: str = "nexus-demo-project"
    departing_member: str
    incoming_member: str
    incoming_role: str

class HandoverUpdate(BaseModel):
    content: dict[str, Any]

class HandoverReview(BaseModel):
    reviewer: str = "Workspace Admin"
    comment: str = ""




def groq_chat(system_prompt: str, user_prompt: str) -> str:
    """Call Groq and return a JSON-formatted response."""
    import urllib.request
    import urllib.error

    api_key = os.getenv("GROQ_API_KEY", "").strip()

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI service is not configured. Please check the backend environment."
        )

    body = {
        "model": os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
        "temperature": 0.1,
        "max_completion_tokens": 4096,
        "reasoning_effort": "low",
        "reasoning_format": "hidden",
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": system_prompt + "\nReturn one valid JSON object only. Do not include Markdown or explanations."
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ]
    }

    request_data = json.dumps(body).encode("utf-8")

    for attempt in range(2):
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=request_data,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "HandOverIQ/1.0"
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=120) as response:
                result = json.loads(response.read().decode("utf-8"))

            content = result["choices"][0]["message"].get("content")

            if not content or not content.strip():
                raise HTTPException(
                    status_code=502,
                    detail="Groq returned an empty AI response. Please try again."
                )

            return content.strip()

        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")

            if exc.code == 429 and attempt == 0:
                retry_after = exc.headers.get("Retry-After", "4")

                try:
                    wait_seconds = min(max(float(retry_after), 1), 10)
                except (ValueError, TypeError):
                    wait_seconds = 4

                time.sleep(wait_seconds)
                continue

            raise HTTPException(
                status_code=502,
                detail=f"Groq API error ({exc.code}): {detail[:500]}"
            )

        except HTTPException:
            raise

        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"AI response processing failed: {str(exc)}"
            ) from exc

    raise HTTPException(
        status_code=502,
        detail="AI generation failed. Please try again."
    )




def parse_json_object(raw: str) -> dict[str, Any]:
    try:
        if not raw or not raw.strip():
            raise ValueError("Empty AI response")

        cleaned = raw.strip()

        # Remove Markdown code fences if present.
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

        # Extract the JSON object if extra text is present.
        start = cleaned.find("{")
        end = cleaned.rfind("}")

        if start == -1 or end == -1 or end < start:
            raise ValueError("No JSON object found in AI response")

        data = json.loads(cleaned[start:end + 1])

        if not isinstance(data, dict):
            raise ValueError("Expected a JSON object")

        return data

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI returned invalid JSON: {exc}"
        ) from exc


def ensure_module_tables() -> None:
    with db() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS intelligence_records (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL, category TEXT NOT NULL,
            description TEXT NOT NULL, responsible_person TEXT, status TEXT NOT NULL,
            source_chunk_id TEXT, evidence_excerpt TEXT, is_recommendation INTEGER DEFAULT 0,
            created_at TEXT NOT NULL)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS handovers (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL, departing_member TEXT NOT NULL,
            incoming_member TEXT NOT NULL, incoming_role TEXT NOT NULL, content_json TEXT NOT NULL,
            status TEXT NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL, approved_by TEXT, approved_at TEXT)""")
        conn.execute("""CREATE TABLE IF NOT EXISTS handover_reviews (
            id TEXT PRIMARY KEY, handover_id TEXT NOT NULL, version INTEGER NOT NULL,
            action TEXT NOT NULL, reviewer TEXT NOT NULL, comment TEXT, created_at TEXT NOT NULL)""")

ensure_module_tables()

@app.get("/api/intelligence")
def get_intelligence(project_id: str = "nexus-demo-project"):
    with db() as conn:
        rows = conn.execute("SELECT * FROM intelligence_records WHERE project_id=? ORDER BY created_at DESC", (project_id,)).fetchall()
    return {"records": [dict(r) for r in rows]}

@app.post("/api/intelligence/analyze")
def analyze_project(payload: IntelligenceRun):
    with db() as conn:
        if payload.source_ids:
            marks = ",".join("?" for _ in payload.source_ids)
            rows = conn.execute(f"SELECT id,filename,page_or_section,original_text FROM chunks WHERE project_id=? AND source_id IN ({marks}) ORDER BY filename,chunk_index", [payload.project_id, *payload.source_ids]).fetchall()
        else:
            rows = conn.execute("SELECT id,filename,page_or_section,original_text FROM chunks WHERE project_id=? ORDER BY filename,chunk_index", (payload.project_id,)).fetchall()
    if not rows:
        raise HTTPException(status_code=400, detail="Upload project documents in Knowledge Sources before running analysis.")
    source_material = [{"source_id": r["id"], "filename": r["filename"], "page_or_section": r["page_or_section"], "text": r["original_text"]} for r in rows]
    system = """You are Handover IQ Project Intelligence Engine. Analyze only supplied authorised project information. Return valid JSON with key 'records', an array of objects with: category (one of project_overview, decision, responsibility, completed_task, pending_task, dependency, blocker, risk, unresolved_question, recommendation), description, responsible_person (string or null), status (explicit status or 'Unknown'), source_id (exact supplied source_id or null), evidence_excerpt (exact verbatim substring from that source or null), is_recommendation (boolean). Never invent people, dates, ownership, decisions or completion. Do not mark a task completed unless explicit evidence says so. Separate recommendations from facts. For recommendations use category recommendation and is_recommendation true. If no evidence supports a record, source_id and evidence_excerpt must be null. Keep concise. Return JSON only."""
    user = "Analyze this project information and extract the project overview, decisions and reasons, responsibilities, completed and pending tasks, dependencies, blockers, risks, unresolved questions and recommended next actions.\nPROJECT INFORMATION:\n" + json.dumps(source_material, ensure_ascii=False)
    result = parse_json_object(groq_chat(system, user))
    records = result.get("records", [])
    if not isinstance(records, list):
        raise HTTPException(status_code=502, detail="AI response schema invalid: records must be an array.")
    allowed = {r["id"]: r for r in rows}
    saved = []
    now = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        conn.execute("DELETE FROM intelligence_records WHERE project_id=?", (payload.project_id,))
        for item in records:
            if not isinstance(item, dict) or not str(item.get("description", "")).strip():
                continue
            source_id = item.get("source_id")
            excerpt = item.get("evidence_excerpt")
            # Strictly validate source identity and exact quotation against the stored chunk.
            if source_id not in allowed or not excerpt or excerpt not in allowed[source_id]["original_text"]:
                source_id, excerpt = None, None
            category = str(item.get("category", "unresolved_question"))
            rec = {"id": str(uuid.uuid4()), "project_id": payload.project_id,
                "category": category, "description": str(item["description"]).strip(),
                "responsible_person": item.get("responsible_person"),
                "status": str(item.get("status") or "Unknown"), "source_chunk_id": source_id,
                "evidence_excerpt": excerpt, "is_recommendation": int(bool(item.get("is_recommendation", False))),
                "created_at": now}
            conn.execute("""INSERT INTO intelligence_records
                (id,project_id,category,description,responsible_person,status,source_chunk_id,evidence_excerpt,is_recommendation,created_at)
                VALUES (:id,:project_id,:category,:description,:responsible_person,:status,:source_chunk_id,:evidence_excerpt,:is_recommendation,:created_at)""", rec)
            saved.append(rec)
    return {"records": saved, "count": len(saved), "source_chunks_analyzed": len(rows), "message": "Analysis complete. Unmatched citations were removed and remain unsupported."}


@app.post("/api/handovers/generate")
def generate_handover(payload: HandoverRequest):

    if (
        not payload.departing_member.strip()
        or not payload.incoming_member.strip()
        or not payload.incoming_role.strip()
    ):
        raise HTTPException(
            status_code=400,
            detail="Departing member, incoming member and role are required."
        )

    # Fetch a limited number of recent intelligence records.
    with db() as conn:
        rows = conn.execute(
            """
            SELECT id, category, description, responsible_person,
                   status, is_recommendation
            FROM intelligence_records
            WHERE project_id = ?
            ORDER BY created_at DESC
            LIMIT 30
            """,
            (payload.project_id,)
        ).fetchall()

    if not rows:
        raise HTTPException(
            status_code=400,
            detail="Run AI Project Intelligence first to create project knowledge."
        )

    # Send only the fields needed for handover generation.
    # Limit description length to control token usage.
    knowledge = []

    for row in rows:
        knowledge.append({
            "id": row["id"],
            "category": row["category"],
            "description": str(row["description"])[:500],
            "responsible_person": row["responsible_person"],
            "status": row["status"],
            "is_recommendation": bool(row["is_recommendation"])
        })

    system = """
You create a role-specific project handover.

Use only the supplied structured project intelligence.

Return a valid JSON object with these keys:
project_overview (string),
previous_responsibilities (array),
completed_work (array),
pending_work (array),
technical_decisions (array),
dependencies (array),
known_issues (array),
important_contacts (array),
next_actions (array),
missing_information (array).

Each array item must be an object containing:
title, details, source_record_ids, status.

Instructions:
- Prioritize information relevant to the incoming member's role.
- Do not invent facts, names, dates or contact details.
- Clearly label unknown information.
- Do not present recommendations as completed facts.
- Use only supplied record IDs in source_record_ids.
- Keep descriptions concise.
- If information is unavailable, use an empty array.
- Return JSON only.
"""

    user_data = {
        "departing_member": payload.departing_member.strip(),
        "incoming_member": payload.incoming_member.strip(),
        "incoming_role": payload.incoming_role.strip(),
        "project_intelligence": knowledge
    }

    user = json.dumps(user_data, ensure_ascii=False)

    # Generate the role-specific handover.
    content = parse_json_object(groq_chat(system, user))

    # Ensure all required sections exist.
    sections = [
        "previous_responsibilities",
        "completed_work",
        "pending_work",
        "technical_decisions",
        "dependencies",
        "known_issues",
        "important_contacts",
        "next_actions",
        "missing_information"
    ]

    content.setdefault(
        "project_overview",
        "Unknown — no supported overview was returned."
    )

    for key in sections:
        if not isinstance(content.get(key), list):
            content[key] = []

    now = datetime.now(timezone.utc).isoformat()
    handover_id = str(uuid.uuid4())

    with db() as conn:

        version = conn.execute(
            """
            SELECT COALESCE(MAX(version), 0) + 1
            FROM handovers
            WHERE project_id = ? AND incoming_member = ?
            """,
            (payload.project_id, payload.incoming_member.strip())
        ).fetchone()[0]

        conn.execute(
            """
            INSERT INTO handovers (
                id, project_id, departing_member, incoming_member,
                incoming_role, content_json, status, version,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                handover_id,
                payload.project_id,
                payload.departing_member.strip(),
                payload.incoming_member.strip(),
                payload.incoming_role.strip(),
                json.dumps(content, ensure_ascii=False),
                "draft",
                version,
                now,
                now
            )
        )

    return {
        "id": handover_id,
        "project_id": payload.project_id,
        "departing_member": payload.departing_member,
        "incoming_member": payload.incoming_member,
        "incoming_role": payload.incoming_role,
        "content": content,
        "status": "draft",
        "version": version,
        "created_at": now
    }


def handover_payload(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row); data["content"] = json.loads(data.pop("content_json")); return data

@app.get("/api/handovers")
def list_handovers(project_id: str = "nexus-demo-project"):
    with db() as conn:
        rows = conn.execute("SELECT * FROM handovers WHERE project_id=? ORDER BY created_at DESC", (project_id,)).fetchall()
    return {"handovers": [handover_payload(r) for r in rows]}

@app.get("/api/handovers/{handover_id}")
def get_handover(handover_id: str):
    with db() as conn:
        row = conn.execute("SELECT * FROM handovers WHERE id=?", (handover_id,)).fetchone()
        if not row: raise HTTPException(status_code=404, detail="Handover not found.")
        reviews = conn.execute("SELECT * FROM handover_reviews WHERE handover_id=? ORDER BY created_at DESC", (handover_id,)).fetchall()
    result = handover_payload(row); result["reviews"] = [dict(r) for r in reviews]; return result

@app.put("/api/handovers/{handover_id}")
def update_handover(handover_id: str, payload: HandoverUpdate):
    now = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        row = conn.execute("SELECT * FROM handovers WHERE id=?", (handover_id,)).fetchone()
        if not row: raise HTTPException(status_code=404, detail="Handover not found.")
        if row["status"] == "approved": raise HTTPException(status_code=409, detail="Approved versions are immutable. Generate or save a new draft to make changes.")
        version = row["version"] + 1
        conn.execute("UPDATE handovers SET content_json=?,status='draft',version=?,updated_at=?,approved_by=NULL,approved_at=NULL WHERE id=?", (json.dumps(payload.content,ensure_ascii=False),version,now,handover_id))
        updated = conn.execute("SELECT * FROM handovers WHERE id=?", (handover_id,)).fetchone()
    return handover_payload(updated)

@app.post("/api/handovers/{handover_id}/approve")
def approve_handover(handover_id: str, payload: HandoverReview):
    now = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        row = conn.execute("SELECT * FROM handovers WHERE id=?", (handover_id,)).fetchone()
        if not row: raise HTTPException(status_code=404, detail="Handover not found.")
        conn.execute("UPDATE handovers SET status='approved',approved_by=?,approved_at=?,updated_at=? WHERE id=?", (payload.reviewer,now,now,handover_id))
        conn.execute("INSERT INTO handover_reviews (id,handover_id,version,action,reviewer,comment,created_at) VALUES (?,?,?,?,?,?,?)", (str(uuid.uuid4()),handover_id,row["version"],"approved",payload.reviewer,payload.comment,now))
        updated = conn.execute("SELECT * FROM handovers WHERE id=?", (handover_id,)).fetchone()
    return handover_payload(updated)

@app.post("/api/handovers/{handover_id}/request-changes")
def request_handover_changes(handover_id: str, payload: HandoverReview):
    now = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        row = conn.execute("SELECT * FROM handovers WHERE id=?", (handover_id,)).fetchone()
        if not row: raise HTTPException(status_code=404, detail="Handover not found.")
        conn.execute("UPDATE handovers SET status='changes_requested',updated_at=? WHERE id=?", (now,handover_id))
        conn.execute("INSERT INTO handover_reviews (id,handover_id,version,action,reviewer,comment,created_at) VALUES (?,?,?,?,?,?,?)", (str(uuid.uuid4()),handover_id,row["version"],"changes_requested",payload.reviewer,payload.comment,now))
        updated = conn.execute("SELECT * FROM handovers WHERE id=?", (handover_id,)).fetchone()
    return handover_payload(updated)

@app.get("/api/handovers/{handover_id}/export.pdf")
def export_handover_pdf(handover_id: str):
    from fastapi.responses import StreamingResponse
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import mm
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="PDF export dependency missing. Run pip install reportlab.") from exc
    with db() as conn:
        row = conn.execute("SELECT * FROM handovers WHERE id=?", (handover_id,)).fetchone()
    if not row: raise HTTPException(status_code=404, detail="Handover not found.")
    if row["status"] != "approved": raise HTTPException(status_code=403, detail="Only an approved handover can be exported as the final PDF.")
    from xml.sax.saxutils import escape
    content = json.loads(row["content_json"])
    buffer = io.BytesIO(); doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=18*mm,leftMargin=18*mm,topMargin=18*mm,bottomMargin=18*mm)
    styles = getSampleStyleSheet(); styles.add(ParagraphStyle(name="HandoverIQTitle",parent=styles["Title"],textColor=colors.HexColor("#12324a"),spaceAfter=8))
    story = [Paragraph("Handover IQ — Project Handover", styles["HandoverIQTitle"]),
        Paragraph(f"Departing: {escape(row['departing_member'])} | Incoming: {escape(row['incoming_member'])} ({escape(row['incoming_role'])})", styles["Normal"]),
        Paragraph(f"Approved by: {escape(row['approved_by'] or '')} | Version: {row['version']}", styles["Normal"]), Spacer(1,10),
        Paragraph("Project overview", styles["Heading2"]), Paragraph(escape(str(content.get("project_overview","Unknown"))), styles["BodyText"])]
    for key in ["previous_responsibilities","completed_work","pending_work","technical_decisions","dependencies","known_issues","important_contacts","next_actions","missing_information"]:
        story.append(Paragraph(escape(key.replace("_"," ").title()), styles["Heading2"]))
        items = content.get(key, [])
        if not items: story.append(Paragraph("No supported information recorded.", styles["BodyText"]))
        for item in items:
            if isinstance(item, dict):
                title = escape(str(item.get("title","Item"))); details = escape(str(item.get("details",""))); status = escape(str(item.get("status","")))
                story.append(Paragraph(f"• <b>{title}</b> — {details} <font color='#64748b'>({status})</font>", styles["BodyText"]))
            else: story.append(Paragraph("• " + escape(str(item)), styles["BodyText"]))
            story.append(Spacer(1,4))
    doc.build(story); buffer.seek(0)
    headers = {"Content-Disposition": f'attachment; filename="handover-iq-report-v{row["version"]}.pdf"'}
    return StreamingResponse(buffer, media_type="application/pdf", headers=headers)
