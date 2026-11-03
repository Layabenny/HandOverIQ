import { useEffect, useMemo, useState } from 'react'
import {
  Search, ShieldCheck, BrainCircuit, FileText, CheckCircle2,
  AlertTriangle, XCircle, Plus, Pencil, RefreshCw, Link2
} from 'lucide-react'

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '')

type Evidence = {
  chunk_id: string
  source_id: string
  filename: string
  page_or_section: string
  original_text: string
}
type Review = {
  action: string
  comment: string
  reviewer: string
  created_at: string
}
type Claim = {
  id: string
  claim: string
  category: string
  status: string
  evidence: Evidence[]
  reviews: Review[]
}

const statusLabel: Record<string, string> = {
  verified: 'Verified',
  needs_verification: 'Needs verification',
  conflicting: 'Conflicting',
  missing_evidence: 'Missing evidence',
  rejected: 'Rejected'
}

async function readError(response: Response) {
  try {
    const data = await response.json()
    return data.detail || data.message || `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

export default function EvidenceExplorer({
  onBack,
  onModules
}: {
  onBack: () => void
  onModules: () => void
}) {
  const [claims, setClaims] = useState<Claim[]>([])
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [selected, setSelected] = useState('')
  const [query, setQuery] = useState('')
  const [claimText, setClaimText] = useState('')
  const [category, setCategory] = useState('Project status')
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([])
  const [editing, setEditing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [comment, setComment] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const projectId = localStorage.getItem('nexus_project_id') || ''
  const token = localStorage.getItem('nexus_token') || ''

  async function request(path: string, init?: RequestInit) {
    if (!token) throw new Error('Please sign in to access this workspace.')
    if (!projectId) throw new Error('No workspace is selected. Please select a project and try again.')

    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${token}`)
    headers.set('X-Project-ID', projectId)
    if (!(init?.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(`${API}${path}`, {
      ...init,
      headers
    })

    if (!response.ok) throw new Error(await readError(response))
    return response.json()
  }

  async function load(preferredId?: string) {
    setBusy(true)
    setNotice('')

    try {
      const projectQuery = `?project_id=${encodeURIComponent(projectId)}`
      const [claimsData, evidenceData] = await Promise.all([
        request(`/api/claims${projectQuery}`),
        request(`/api/evidence${projectQuery}`)
      ])

      const nextClaims: Claim[] = Array.isArray(claimsData.claims) ? claimsData.claims : []
      setClaims(nextClaims)
      setEvidence(Array.isArray(evidenceData.evidence) ? evidenceData.evidence : [])

      const wantedId = preferredId || selected
      const selectedStillExists = nextClaims.some(claim => claim.id === wantedId)
      setSelected(selectedStillExists ? wantedId : (nextClaims[0]?.id || ''))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load evidence.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void load()
    // Load once when this screen mounts; the active project is read from localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active = claims.find(claim => claim.id === selected) || claims[0]

  const visible = useMemo(
    () =>
      claims.filter(
        claim =>
          claim.claim.toLowerCase().includes(query.toLowerCase()) ||
          claim.category.toLowerCase().includes(query.toLowerCase())
      ),
    [claims, query]
  )

  const counts = {
    total: claims.length,
    verified: claims.filter(claim => claim.status === 'verified').length,
    pending: claims.filter(claim => claim.status === 'needs_verification').length,
    missing: claims.filter(claim => claim.status === 'missing_evidence').length
  }

  function startNew() {
    setClaimText('')
    setCategory('Project status')
    setSelectedEvidence([])
    setEditing(false)
    setShowForm(true)
  }

  function startEdit() {
    if (!active) return
    setClaimText(active.claim)
    setCategory(active.category)
    setSelectedEvidence(active.evidence.map(item => item.chunk_id))
    setEditing(true)
    setShowForm(true)
  }

  async function saveClaim() {
    if (!claimText.trim()) {
      setNotice('Enter a claim first.')
      return
    }

    if (!projectId) {
      setNotice('No workspace is selected. Please select a project and try again.')
      return
    }

    setBusy(true)
    setNotice('')

    try {
      const payload = JSON.stringify({
        project_id: projectId,
        claim: claimText.trim(),
        category,
        evidence_ids: selectedEvidence
      })

      const result = await request(
        editing && active ? `/api/claims/${encodeURIComponent(active.id)}` : '/api/claims',
        {
          method: editing && active ? 'PUT' : 'POST',
          body: payload
        }
      )

      setShowForm(false)
      await load(result.id)
      setNotice('Claim saved with its source references.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save claim.')
    } finally {
      setBusy(false)
    }
  }

  async function review(action: 'verify' | 'conflicting' | 'reject') {
    if (!active) return

    setBusy(true)
    setNotice('')

    try {
      const result = await request(`/api/claims/${encodeURIComponent(active.id)}/review`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          comment: comment.trim(),
          reviewer: 'Workspace Admin'
        })
      })

      setClaims(previous => previous.map(claim => claim.id === result.id ? result : claim))
      setComment('')
      setNotice(
        action === 'verify'
          ? 'Claim verified.'
          : action === 'reject'
            ? 'Claim rejected.'
            : 'Claim marked as conflicting.'
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Review failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ev-page">
      <aside className="ev-sidebar">
        <button className="ev-brand" onClick={onBack}><span>✳</span>Handover <b>IQ</b></button>
        <div className="ev-workspace"><i>N</i><span><b>Handover IQ Workspace</b><small>Project workspace</small></span></div>
        <small className="ev-side-label">WORKSPACE</small>
        <button className="ev-nav" onClick={onBack}>▦ &nbsp; Overview</button>
        <button className="ev-nav" onClick={onBack}><FileText size={16} /> Knowledge Sources</button>
        <button className="ev-nav active"><ShieldCheck size={16} /> Evidence Explorer</button>
        <button className="ev-nav" onClick={onModules}><BrainCircuit size={16} /> AI Intelligence &amp; Handover</button>
        <div className="ev-side-foot">CA &nbsp; Workspace Admin</div>
      </aside>

      <main className="ev-main">
        <header className="ev-top">
          <div><button onClick={onBack}>Workspace</button><span>/</span><b>Evidence Explorer</b></div>
          <span><ShieldCheck size={14} /> Evidence-led review</span>
        </header>

        <section className="ev-content">
          <div className="ev-heading">
            <div><small>TRUST &amp; CITATIONS / CLAIM VALIDATION</small><h1>Evidence Explorer</h1><p>Trace every project claim back to the original source and review it before it becomes trusted project knowledge.</p></div>
            <button className="ev-primary" onClick={startNew} disabled={busy}><Plus size={15} /> Add project claim</button>
          </div>

          <div className="ev-stats">
            <div><small>TOTAL CLAIMS</small><strong>{counts.total}</strong></div>
            <div><small>VERIFIED</small><strong className="green">{counts.verified}</strong></div>
            <div><small>NEEDS REVIEW</small><strong className="amber">{counts.pending}</strong></div>
            <div><small>MISSING EVIDENCE</small><strong>{counts.missing}</strong></div>
          </div>

          <div className="ev-workarea">
            <section className="ev-claims">
              <div className="ev-list-head"><b>Project claims <span>{claims.length}</span></b><button onClick={() => void load()} title="Refresh" disabled={busy}><RefreshCw size={14} /></button></div>
              <div className="ev-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search claims..." /></div>

              {visible.length === 0 ? (
                <div className="ev-empty"><ShieldCheck size={25} /><b>No claims yet</b><p>Add a claim and link it to extracted evidence chunks from Knowledge Sources.</p></div>
              ) : visible.map(claim => (
                <button
                  key={claim.id}
                  className={`ev-claim ${active?.id === claim.id ? 'selected' : ''}`}
                  onClick={() => setSelected(claim.id)}
                >
                  <span className={`ev-status-dot ${claim.status}`} />
                  <span>
                    <b>{claim.claim}</b>
                    <small>{claim.category} · {claim.evidence?.length || 0} source{claim.evidence?.length === 1 ? '' : 's'}</small>
                    <em className={`ev-pill ${claim.status}`}>{statusLabel[claim.status] || claim.status}</em>
                  </span>
                </button>
              ))}
            </section>

            <section className="ev-detail">
              {active ? (
                <>
                  <div className="ev-detail-head">
                    <div><small>EXTRACTED PROJECT INFORMATION</small><h2>{active.claim}</h2><span className={`ev-pill ${active.status}`}>{statusLabel[active.status] || active.status}</span></div>
                    <button className="ev-icon-btn" onClick={startEdit} disabled={busy}><Pencil size={15} /> Edit</button>
                  </div>

                  <div className="ev-evidence-title"><b>Supporting evidence</b><span>{active.evidence?.length || 0} linked source chunks</span></div>
                  {active.evidence?.length ? active.evidence.map(item => (
                    <article className="ev-source" key={item.chunk_id}>
                      <div className="ev-source-head"><FileText size={16} /><b>{item.filename}</b><span>{item.page_or_section || 'Source section'}</span></div>
                      <blockquote>{item.original_text}</blockquote>
                      <small><Link2 size={12} /> Evidence ID: {item.chunk_id}</small>
                    </article>
                  )) : (
                    <div className="ev-no-evidence"><AlertTriangle size={18} /><span><b>No supporting evidence found</b><small>This claim cannot be verified until a source chunk is linked.</small></span></div>
                  )}

                  <div className="ev-review">
                    <b>Human review</b>
                    <textarea value={comment} onChange={event => setComment(event.target.value)} placeholder="Optional review comment..." rows={2} />
                    <div>
                      <button className="ev-verify" onClick={() => void review('verify')} disabled={!active.evidence?.length || busy}><CheckCircle2 size={15} /> Verify</button>
                      <button className="ev-conflict" onClick={() => void review('conflicting')} disabled={busy}><AlertTriangle size={15} /> Conflicting</button>
                      <button className="ev-reject" onClick={() => void review('reject')} disabled={busy}><XCircle size={15} /> Reject</button>
                    </div>
                  </div>

                  {!!active.reviews?.length && (
                    <div className="ev-history">
                      <b>Review history</b>
                      {active.reviews.map((reviewItem, index) => (
                        <p key={`${reviewItem.created_at}-${index}`}>{reviewItem.action} · {reviewItem.reviewer}{reviewItem.comment && ` — ${reviewItem.comment}`}</p>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="ev-empty ev-detail-empty"><ShieldCheck size={32} /><b>Select a project claim</b><p>Choose a claim on the left, or add a new one to start reviewing its evidence.</p></div>
              )}
            </section>
          </div>

          {showForm && (
            <div className="ev-modal-back" onClick={() => setShowForm(false)}>
              <div className="ev-modal" onClick={event => event.stopPropagation()}>
                <button className="ev-close" onClick={() => setShowForm(false)}>×</button>
                <small>CLAIM &amp; SOURCE MAPPING</small>
                <h2>{editing ? 'Edit claim' : 'Add project claim'}</h2>
                <label>Extracted project information</label>
                <textarea rows={3} value={claimText} onChange={event => setClaimText(event.target.value)} placeholder="e.g. Payment gateway integration is incomplete." />
                <label>Category</label>
                <select value={category} onChange={event => setCategory(event.target.value)}>
                  <option>Project status</option><option>Decision</option><option>Task</option><option>Risk</option><option>Dependency</option>
                </select>
                <label>Link supporting evidence chunks</label>
                <div className="ev-evidence-picker">
                  {evidence.map(item => (
                    <label key={item.chunk_id}>
                      <input
                        type="checkbox"
                        checked={selectedEvidence.includes(item.chunk_id)}
                        onChange={event => setSelectedEvidence(previous =>
                          event.target.checked
                            ? [...previous, item.chunk_id]
                            : previous.filter(id => id !== item.chunk_id)
                        )}
                      />
                      <span><b>{item.filename} · {item.page_or_section}</b><small>{item.original_text}</small></span>
                    </label>
                  ))}
                  {!evidence.length && <p>No evidence chunks yet. Upload a document in Knowledge Sources first.</p>}
                </div>
                <div className="ev-modal-actions">
                  <button onClick={() => setShowForm(false)} disabled={busy}>Cancel</button>
                  <button className="ev-primary" onClick={() => void saveClaim()} disabled={busy}>{busy ? 'Saving...' : 'Save claim'} <Plus size={14} /></button>
                </div>
              </div>
            </div>
          )}

          {notice && <div className="ev-notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}
          {busy && <div className="ev-busy"><RefreshCw size={14} className="ks-spin" /> Working...</div>}
        </section>
      </main>
    </div>
  )
}
