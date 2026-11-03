import { useEffect, useState } from 'react'
import {
  BrainCircuit,
  RefreshCw,
  FileText,
  WandSparkles,
  ShieldCheck,
  Download,
  Save,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  LogOut,
  UserRound,
} from 'lucide-react'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
function getProjectId() {
  return localStorage.getItem('nexus_project_id') || ''
}

type RecordItem = {
  id: string
  category: string
  description: string
  responsible_person?: string | null
  status: string
  source_chunk_id?: string | null
  evidence_excerpt?: string | null
  is_recommendation: number
}

type Handover = {
  id: string
  departing_member: string
  incoming_member: string
  incoming_role: string
  content: Record<string, any>
  status: string
  version: number
  approved_by?: string | null
}

const label = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (x: string) => x.toUpperCase())

async function api(path: string, init?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('nexus_token') || ''}`,
      'X-Project-ID': getProjectId(),
      ...(init?.headers || {}),
    },
  })

  const d = await r.json()

  if (!r.ok) {
    throw new Error(d.detail || 'Request failed')
  }

  return d
}

export default function ProjectModules({
  onBack,
  onLogout,
  initialTab = 'intelligence',
}: {
  onBack: () => void
  onLogout: () => void
  initialTab?: 'intelligence' | 'generator' | 'approval'
}) {
  const [tab, setTab] = useState<'intelligence' | 'generator' | 'approval'>(initialTab)
  const [records, setRecords] = useState<RecordItem[]>([])
  const [handovers, setHandovers] = useState<Handover[]>([])
  const [active, setActive] = useState<Handover | null>(null)

  const [departing, setDeparting] = useState('')
  const [incoming, setIncoming] = useState('')
  const [role, setRole] = useState('Backend Developer')

  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [reviewComment, setReviewComment] = useState('')
  const [editJson, setEditJson] = useState('')
  const [showProfile, setShowProfile] = useState(false)

  async function refresh() {
    try {
      const [r, h] = await Promise.all([
        api(`/api/intelligence?project_id=${getProjectId()}`),
        api(`/api/handovers?project_id=${getProjectId()}`),
      ])

      setRecords(r.records || [])
      setHandovers(h.handovers || [])

      if (active) {
        const latest = h.handovers.find((x: Handover) => x.id === active.id)

        if (latest) {
          setActive(latest)
          setEditJson(JSON.stringify(latest.content, null, 2))
        }
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not load project data.')
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function analyze() {
    setBusy(true)
    setNotice('')

    try {
      const d = await api('/api/intelligence/analyze', {
        method: 'POST',
        body: JSON.stringify({ project_id: getProjectId() }),
      })

      setRecords(d.records || [])
      setNotice(
        `Analysis complete: ${d.count} records extracted from ${d.source_chunks_analyzed} evidence chunks.`
      )
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Analysis failed.')
    } finally {
      setBusy(false)
    }
  }

  async function generate() {
    if (!departing.trim() || !incoming.trim()) {
      setNotice('Enter both team member names.')
      return
    }

    setBusy(true)
    setNotice('')

    try {
      const d = await api('/api/handovers/generate', {
        method: 'POST',
        body: JSON.stringify({
          project_id: getProjectId(),
          departing_member: departing,
          incoming_member: incoming,
          incoming_role: role,
        }),
      })

      setActive(d)
      setEditJson(JSON.stringify(d.content, null, 2))

      setHandovers(previous => [
        d,
        ...previous.filter(h => h.id !== d.id),
      ])

      setTab('approval')
      setNotice('Handover draft generated. Review and edit it before approval.')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Handover generation failed.')
    } finally {
      setBusy(false)
    }
  }

  function selectHandover(h: Handover) {
    setActive(h)
    setEditJson(JSON.stringify(h.content, null, 2))
    setTab('approval')
  }

  async function saveDraft() {
    if (!active) return

    setBusy(true)

    try {
      const content = JSON.parse(editJson)

      const d = await api(`/api/handovers/${active.id}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      })

      setActive(d)
      setEditJson(JSON.stringify(d.content, null, 2))

      await refresh()
      setNotice(`Draft saved as version ${d.version}.`)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Invalid JSON or save failed.')
    } finally {
      setBusy(false)
    }
  }

  async function review(action: 'approve' | 'request-changes') {
    if (!active) return

    setBusy(true)

    try {
      const d = await api(`/api/handovers/${active.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({
          reviewer: 'Workspace Admin',
          comment: reviewComment,
        }),
      })

      setActive(d)
      await refresh()

      setNotice(
        action === 'approve'
          ? 'Handover approved. PDF export is now enabled.'
          : 'Changes requested.'
      )
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Review action failed.')
    } finally {
      setBusy(false)
    }
  }

  async function exportPdf() {
    if (!active) return

    const token = localStorage.getItem('nexus_token')

    if (!token) {
      setNotice('Your session has expired. Please sign in again.')
      return
    }

    if (active.status !== 'approved') {
      setNotice('Only approved handovers can be exported.')
      return
    }

    setBusy(true)
    setNotice('')

    try {
      const response = await fetch(
        `${API}/api/handovers/${active.id}/export.pdf`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Project-ID': getProjectId(),
          },
        }
      )

      if (!response.ok) {
        let errorMessage = 'PDF download failed.'

        try {
          const errorData = await response.json()
          errorMessage = errorData.detail || errorMessage
        } catch {
          // Keep the default error message.
        }

        throw new Error(errorMessage)
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = downloadUrl
      link.download = `handover-iq-report-v${active.version}.pdf`

      document.body.appendChild(link)
      link.click()
      link.remove()

      window.URL.revokeObjectURL(downloadUrl)
      setNotice('PDF downloaded successfully.')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not download PDF.')
    } finally {
      setBusy(false)
    }
  }

  const email = localStorage.getItem('nexus_email') || 'Workspace Admin'

  return (
    <div className="ev-page">
      <aside className="ev-sidebar">
        <button className="ev-brand" onClick={onBack}>
          <span>✳</span>Handover <b>IQ</b>
        </button>

        <div className="ev-workspace">
          <i>N</i>
          <span>
            <b>Handover IQ Workspace</b>
            <small>Demo project</small>
          </span>
        </div>

        <small className="ev-side-label">PROJECT WORKSPACE</small>

        <button className="ev-nav" onClick={onBack}>
          ← &nbsp; Knowledge Sources
        </button>

        <button className="ev-nav" onClick={() => setTab('intelligence')}>
          <BrainCircuit size={15} /> Project Intelligence
        </button>

        <button className="ev-nav" onClick={() => setTab('generator')}>
          <WandSparkles size={15} /> Handover Generator
        </button>

        <button className="ev-nav" onClick={() => setTab('approval')}>
          <ShieldCheck size={15} /> Review & Approval
        </button>

        <div className="ev-side-foot">
          <div className="ev-profile-info">
            <UserRound size={16} />
            <span>
              <b>Workspace Admin</b>
              <small>{email}</small>
            </span>
          </div>

          <button className="ev-logout-btn" onClick={onLogout}>
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </aside>

      <main className="ev-main">
        <header className="ev-top">
          <div>
            <button onClick={onBack}>Workspace</button>
            <span>/</span>
            <b>
              {tab === 'intelligence'
                ? 'AI Project Intelligence'
                : tab === 'generator'
                  ? 'Smart Handover Generator'
                  : 'Review & Approval'}
            </b>
          </div>

          <div className="ev-top-actions">
            <button
              className="ev-profile-btn"
              onClick={() => setShowProfile(!showProfile)}
            >
              <UserRound size={15} />
              Profile
            </button>

            <button className="ev-logout-btn" onClick={onLogout}>
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </header>

        {showProfile && (
          <div className="ev-profile-notice">
            Signed in as: {email}
          </div>
        )}

        <section className="ev-content">
          {tab === 'intelligence' && (
            <>
              <div className="ev-heading">
                <div>
                  <small>MODULE 02 / STRUCTURED PROJECT UNDERSTANDING</small>
                  <h1>AI Project Intelligence</h1>
                  <p>
                    Turn uploaded project sources into structured decisions,
                    responsibilities, tasks, dependencies, blockers, risks and open questions.
                  </p>
                </div>

                <button
                  className="ev-primary"
                  onClick={() => void analyze()}
                  disabled={busy}
                >
                  <BrainCircuit size={15} />
                  {busy ? 'Analyzing…' : 'Analyze project sources'}
                </button>
              </div>

              <div className="ev-stats">
                <div>
                  <small>EXTRACTED RECORDS</small>
                  <strong>{records.length}</strong>
                </div>

                <div>
                  <small>WITH VERIFIED SOURCE MATCH</small>
                  <strong className="green">
                    {records.filter(r => r.source_chunk_id).length}
                  </strong>
                </div>

                <div>
                  <small>RECOMMENDATIONS</small>
                  <strong>{records.filter(r => r.is_recommendation).length}</strong>
                </div>

                <div>
                  <small>UNSUPPORTED / UNKNOWN</small>
                  <strong className="amber">
                    {records.filter(r => !r.source_chunk_id).length}
                  </strong>
                </div>
              </div>

              <div className="pm-panel">
                <div className="pm-panel-head">
                  <b>Extracted project knowledge</b>
                  <button onClick={() => void refresh()}>
                    <RefreshCw size={13} /> Refresh
                  </button>
                </div>

                {records.length === 0 ? (
                  <div className="ev-empty">
                    <BrainCircuit size={28} />
                    <b>No intelligence records yet</b>
                    <p>
                      Upload project documents in Knowledge Sources, then run the analysis.
                    </p>
                  </div>
                ) : (
                  <div className="pm-record-grid">
                    {records.map(r => (
                      <article className="pm-record" key={r.id}>
                        <div>
                          <span className="pm-category">{label(r.category)}</span>
                          <span className={`ev-pill ${r.source_chunk_id ? 'verified' : 'missing_evidence'}`}>
                            {r.source_chunk_id ? 'Source matched' : 'Needs evidence'}
                          </span>
                        </div>

                        <h3>{r.description}</h3>

                        <p>
                          {r.responsible_person
                            ? `Owner: ${r.responsible_person}`
                            : 'Owner: Unknown'}{' '}
                          · Status: {r.status || 'Unknown'}
                        </p>

                        {r.evidence_excerpt && (
                          <blockquote>{r.evidence_excerpt}</blockquote>
                        )}

                        {r.is_recommendation === 1 && (
                          <small className="pm-recommend">
                            AI recommendation — not an established project fact
                          </small>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="pm-note">
                <AlertTriangle size={15} />
                Only citations that exactly match a stored source chunk are retained.
                Review important claims in Evidence Explorer before treating them as verified.
              </div>
            </>
          )}

          {tab === 'generator' && (
            <>
              <div className="ev-heading">
                <div>
                  <small>MODULE 04 / ROLE-AWARE KNOWLEDGE TRANSFER</small>
                  <h1>Smart Handover Generator</h1>
                  <p>
                    Create a tailored handover using structured project intelligence
                    and the incoming team member's role.
                  </p>
                </div>
              </div>

              <div className="pm-form">
                <div className="pm-form-title">
                  <WandSparkles />
                  <div>
                    <b>Configure handover</b>
                    <small>
                      Choose who is leaving and who is receiving the project knowledge.
                    </small>
                  </div>
                </div>

                <label>Departing team member</label>
                <input
                  value={departing}
                  onChange={e => setDeparting(e.target.value)}
                  placeholder="e.g. Alex — Backend Developer"
                />

                <label>Incoming team member</label>
                <input
                  value={incoming}
                  onChange={e => setIncoming(e.target.value)}
                  placeholder="e.g. Michael"
                />

                <label>Incoming role</label>
                <select value={role} onChange={e => setRole(e.target.value)}>
                  {[
                    'Frontend Developer',
                    'Backend Developer',
                    'Project Manager',
                    'QA Engineer',
                    'Team Lead',
                  ].map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>

                <button
                  className="ev-primary"
                  onClick={() => void generate()}
                  disabled={busy || records.length === 0}
                >
                  <WandSparkles size={15} />
                  {busy ? 'Generating…' : 'Generate role-specific handover'}
                </button>

                {records.length === 0 && (
                  <small className="pm-help">
                    Run Project Intelligence first. Handover generation uses those extracted records.
                  </small>
                )}
              </div>

              <div className="pm-panel">
                <div className="pm-panel-head">
                  <b>Previous handover drafts</b>
                  <span>{handovers.length} saved</span>
                </div>

                {handovers.length === 0 ? (
                  <p className="pm-muted">Generated handovers will appear here.</p>
                ) : (
                  handovers.map(h => (
                    <button
                      className="pm-handover-row"
                      key={h.id}
                      onClick={() => selectHandover(h)}
                    >
                      <FileText size={17} />
                      <span>
                        <b>{h.incoming_member} · {h.incoming_role}</b>
                        <small>From {h.departing_member} · Version {h.version}</small>
                      </span>
                      <em className={`ev-pill ${h.status === 'approved' ? 'verified' : 'needs_verification'}`}>
                        {label(h.status)}
                      </em>
                      <ChevronRight size={15} />
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {tab === 'approval' && (
            <>
              <div className="ev-heading">
                <div>
                  <small>MODULE 05 / HUMAN REVIEW & CONTROLLED SHARING</small>
                  <h1>Review & Approval</h1>
                  <p>
                    Edit the generated handover, request changes or approve a version.
                    Only approved versions can be exported as final PDFs.
                  </p>
                </div>

                {active && (
                  <button
                    className="ev-primary"
                    onClick={() => void exportPdf()}
                    disabled={active.status !== 'approved' || busy}
                  >
                    <Download size={15} />
                    {busy ? 'Preparing PDF…' : 'Export approved PDF'}
                  </button>
                )}
              </div>

              {!active ? (
                <div className="pm-panel">
                  <div className="ev-empty">
                    <FileText size={28} />
                    <b>Select a handover to review</b>
                    <p>
                      Generate one in Smart Handover Generator or select a saved draft below.
                    </p>
                  </div>

                  {handovers.map(h => (
                    <button
                      className="pm-handover-row"
                      key={h.id}
                      onClick={() => selectHandover(h)}
                    >
                      <FileText />
                      <span>
                        <b>{h.incoming_member} · {h.incoming_role}</b>
                        <small>Version {h.version}</small>
                      </span>
                      <em className="ev-pill">{label(h.status)}</em>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="pm-review-meta">
                    <div>
                      <small>HANDOVER VERSION {active.version}</small>
                      <h2>
                        {active.departing_member} <ChevronRight size={16} />{' '}
                        {active.incoming_member}
                      </h2>
                      <p>
                        {active.incoming_role} ·{' '}
                        <span className={`ev-pill ${active.status === 'approved' ? 'verified' : 'needs_verification'}`}>
                          {label(active.status)}
                        </span>
                      </p>
                    </div>

                    <button className="ev-icon-btn" onClick={() => setTab('generator')}>
                      Back to generator
                    </button>
                  </div>

                  <div className="pm-panel">
                    <div className="pm-panel-head">
                      <b>Editable handover content (JSON)</b>
                      <span>Save creates a new version</span>
                    </div>

                    <textarea
                      className="pm-json-editor"
                      value={editJson}
                      onChange={e => setEditJson(e.target.value)}
                      disabled={active.status === 'approved'}
                      spellCheck={false}
                    />

                    <div className="pm-actions">
                      <button
                        className="ev-icon-btn"
                        onClick={() => void saveDraft()}
                        disabled={active.status === 'approved' || busy}
                      >
                        <Save size={14} /> Save edited draft
                      </button>
                    </div>
                  </div>

                  <div className="pm-panel">
                    <b>Approval decision</b>

                    <textarea
                      className="pm-comment"
                      rows={2}
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                      placeholder="Reviewer comments or requested corrections..."
                    />

                    <div className="pm-actions">
                      <button
                        className="ev-conflict"
                        onClick={() => void review('request-changes')}
                        disabled={active.status === 'approved' || busy}
                      >
                        <AlertTriangle size={14} /> Request changes
                      </button>

                      <button
                        className="ev-verify"
                        onClick={() => void review('approve')}
                        disabled={active.status === 'approved' || busy}
                      >
                        <CheckCircle2 size={14} /> Approve version
                      </button>

                      {active.status === 'approved' && (
                        <span className="pm-approved">
                          <ShieldCheck size={14} />
                          Approved by {active.approved_by || 'reviewer'}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {notice && (
            <div className="ev-notice">
              {notice}
              <button onClick={() => setNotice('')}>×</button>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}