import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight, CheckCircle2, Clock3, AlertCircle, X, UploadCloud,
  FileText, FileSpreadsheet, File, Search, Plus, MoreHorizontal,
  FolderOpen, ShieldCheck, RefreshCw, Trash2, Database, Sparkles,
  ChevronDown, Settings2
} from 'lucide-react'

type Status = 'Ready' | 'Processing' | 'Failed' | 'Local preview'
type Source = {
  id: string
  name: string
  size: number
  category: string
  date: string
  status: Status
  detail?: string
}

const categories = [
  'All sources',
  'Project documentation',
  'Meeting minutes',
  'Task records',
  'Technical documentation',
  'Other'
]
const allowed = ['pdf', 'docx', 'txt', 'md', 'csv', 'xlsx', 'json']

const sizeLabel = (size: number) =>
  size < 1024
    ? `${size} B`
    : size < 1048576
      ? `${(size / 1024).toFixed(1)} KB`
      : `${(size / 1048576).toFixed(1)} MB`

const getErrorMessage = async (response: Response) => {
  try {
    const data = await response.json()
    return data.detail || data.message || `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

export default function KnowledgeSources({
  onBack,
  onEvidence,
  onModules
}: {
  onBack: () => void
  onEvidence: () => void
  onModules: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Source[]>([])
  const [category, setCategory] = useState('Project documentation')
  const [filter, setFilter] = useState('All sources')
  const [query, setQuery] = useState('')
  const [drag, setDrag] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [api, setApi] = useState(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
  const [apiOpen, setApiOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const projectId = localStorage.getItem('nexus_project_id') || ''
  const token = localStorage.getItem('nexus_token') || ''
  const baseUrl = api.trim().replace(/\/+$/, '')
  const authHeaders = () => ({
    Authorization: `Bearer ${token}`,
    'X-Project-ID': projectId
  })

  const visible = useMemo(
    () =>
      items.filter(
        item =>
          (filter === 'All sources' || item.category === filter) &&
          item.name.toLowerCase().includes(query.toLowerCase())
      ),
    [items, filter, query]
  )

  const ready = items.filter(item => item.status === 'Ready').length
  const local = items.filter(item => item.status === 'Local preview').length
  const failed = items.filter(item => item.status === 'Failed').length

  useEffect(() => {
    if (!baseUrl) {
      setItems([])
      return
    }

    let cancelled = false

    const loadSources = async () => {
      if (!token || !projectId) {
        setNotice('Please sign in and select a workspace to load saved sources.')
        return
      }

      try {
        const response = await fetch(
          `${baseUrl}/api/sources?project_id=${encodeURIComponent(projectId)}`,
          { headers: authHeaders() }
        )

        if (!response.ok) throw new Error(await getErrorMessage(response))
        const data = await response.json()

        if (!cancelled && Array.isArray(data.sources)) {
          setItems(
            data.sources.map(
              (row: {
                id: string
                filename: string
                category: string
                uploaded_at: string
                chunk_count?: number
                page_count?: number
              }): Source => ({
                id: row.id,
                name: row.filename,
                size: 0,
                category: row.category,
                date: row.uploaded_at,
                status: 'Ready',
                detail: `${row.chunk_count || 0} chunks${
                  row.page_count ? ` · ${row.page_count} pages` : ''
                }`
              })
            )
          )
        }
      } catch (error) {
        if (!cancelled) {
          setNotice(error instanceof Error ? error.message : 'Could not load saved sources.')
        }
      }
    }

    void loadSources()
    return () => {
      cancelled = true
    }
  }, [baseUrl, projectId, token])

  async function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter(file =>
      allowed.includes(file.name.split('.').pop()?.toLowerCase() || '')
    )

    if (!files.length) {
      setNotice('Choose a supported PDF, DOCX, TXT, MD, CSV, XLSX or JSON file.')
      return
    }

    if (!baseUrl) {
      const previews = files.map(file => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        category,
        date: new Date().toISOString(),
        status: 'Local preview' as Status,
        detail: 'Not uploaded. Connect the FastAPI backend to save this source.'
      }))
      setItems(previous => [...previews, ...previous])
      setNotice('Files were added to this browser preview only.')
      if (input.current) input.current.value = ''
      return
    }

    if (!token || !projectId) {
      setNotice('Please sign in and select a workspace before uploading files.')
      return
    }

    setBusy(true)
    setNotice('')

    try {
      for (const file of files) {
        const temporaryId = crypto.randomUUID()
        const selectedCategory = category

        setItems(previous => [
          {
            id: temporaryId,
            name: file.name,
            size: file.size,
            category: selectedCategory,
            date: new Date().toISOString(),
            status: 'Processing'
          },
          ...previous
        ])

        try {
          const form = new FormData()
          form.append('file', file)
          form.append('category', selectedCategory)
          form.append('project_id', projectId)

          const response = await fetch(`${baseUrl}/api/sources/upload`, {
            method: 'POST',
            headers: authHeaders(),
            body: form
          })

          if (!response.ok) throw new Error(await getErrorMessage(response))
          const data = await response.json()

          setItems(previous =>
            previous.map(item =>
              item.id === temporaryId
                ? {
                    ...item,
                    id: data.id || item.id,
                    status: data.status === 'failed' ? 'Failed' : 'Ready',
                    detail: data.message || `${data.chunks_created || 0} chunks created`
                  }
                : item
            )
          )
        } catch (error) {
          setItems(previous =>
            previous.map(item =>
              item.id === temporaryId
                ? {
                    ...item,
                    status: 'Failed',
                    detail: error instanceof Error ? error.message : 'Upload failed'
                  }
                : item
            )
          )
        }
      }

      setNotice('Upload requests completed. Check the status shown beside each source.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function saveText() {
    if (!title.trim() || !body.trim()) {
      setNotice('Enter a note title and content.')
      return
    }

    if (!baseUrl) {
      setItems(previous => [
        {
          id: crypto.randomUUID(),
          name: `${title.trim()}.txt`,
          size: new Blob([body]).size,
          category: 'Meeting minutes',
          date: new Date().toISOString(),
          status: 'Local preview',
          detail: 'This note is only in the browser preview.'
        },
        ...previous
      ])
      setTitle('')
      setBody('')
      setTextOpen(false)
      setNotice('Note added to this browser preview only.')
      return
    }

    if (!token || !projectId) {
      setNotice('Please sign in and select a workspace before saving notes.')
      return
    }

    setBusy(true)
    setNotice('')

    try {
      const response = await fetch(`${baseUrl}/api/sources/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({
          title: title.trim(),
          content: body.trim(),
          category: 'Meeting minutes',
          project_id: projectId
        })
      })

      if (!response.ok) throw new Error(await getErrorMessage(response))
      const data = await response.json()

      setItems(previous => [
        {
          id: data.id || crypto.randomUUID(),
          name: data.filename || `${title.trim()}.txt`,
          size: new Blob([body]).size,
          category: 'Meeting minutes',
          date: new Date().toISOString(),
          status: 'Ready',
          detail: data.message || `${data.chunks_created || 0} chunks created`
        },
        ...previous
      ])

      setTitle('')
      setBody('')
      setTextOpen(false)
      setNotice('Notes saved and processed successfully.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save notes.')
    } finally {
      setBusy(false)
    }
  }

  const iconFor = (name: string) =>
    name.endsWith('.csv') || name.endsWith('.xlsx') ? (
      <FileSpreadsheet size={18} />
    ) : name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.json') ? (
      <File size={18} />
    ) : (
      <FileText size={18} />
    )

  return (
    <div className="ks-page">
      <aside className="ks-sidebar">
        <button className="ks-brand" onClick={onBack}>
          <span className="ks-brand-mark"><Database size={17} /></span>
          Handover <b>IQ</b>
        </button>

        <div className="ks-workspace">
          <span className="ks-workspace-avatar">N</span>
          <span><b>Handover IQ Workspace</b><small>Project workspace</small></span>
          <ChevronDown size={14} />
        </div>

        <div className="ks-side-label">WORKSPACE</div>
        <button className="ks-nav" onClick={onBack}>▦ &nbsp; Overview</button>
        <button className="ks-nav active">
          <FolderOpen size={17} /> Knowledge Sources
          <span className="ks-nav-count">{items.length}</span>
        </button>
        <button className="ks-nav" onClick={onEvidence}><ShieldCheck size={17} /> Evidence Explorer</button>
        <button className="ks-nav" onClick={onModules}><Database size={17} /> AI Intelligence &amp; Handover</button>
        <button className="ks-nav" onClick={() => setNotice('Project DNA will use the sources processed here.')}><Database size={17} /> Project DNA</button>
        <button className="ks-nav" onClick={() => setNotice('Time Capsule will be populated from extracted project events.')}><Clock3 size={17} /> Time Capsule</button>
        <button className="ks-nav" onClick={() => setNotice('Knowledge Radar will use extracted ownership and risk signals.')}><AlertCircle size={17} /> Knowledge Radar</button>

        <div className="ks-side-label ks-side-bottom-label">PREFERENCES</div>
        <button className="ks-nav" onClick={() => setApiOpen(open => !open)}><Settings2 size={17} /> API connection</button>

        <div className="ks-sidebar-footer">
          <span className="ks-avatar">CA</span>
          <span><b>Workspace Admin</b><small>Project member</small></span>
          <MoreHorizontal size={17} />
        </div>
      </aside>

      <main className="ks-main">
        <header className="ks-topbar">
          <div className="ks-breadcrumb"><button onClick={onBack}>Workspace</button><span>/</span><b>Knowledge Sources</b></div>
          <div className="ks-top-actions"><span className="ks-secure"><ShieldCheck size={14} /> Private workspace</span><span className="ks-top-avatar">CA</span></div>
        </header>

        <div className="ks-content">
          <div className="ks-page-heading">
            <div>
              <div className="ks-eyebrow"><i /> PROJECT KNOWLEDGE / INGESTION</div>
              <h1>Knowledge Sources</h1>
              <p>Bring your project's information together. Handover IQ will turn scattered files into connected, searchable knowledge.</p>
            </div>
            <button className="ks-outline-btn" onClick={() => setApiOpen(open => !open)}>
              <Database size={15} />{baseUrl ? 'Backend configured' : 'Connect backend'}
            </button>
          </div>

          {apiOpen && (
            <div className="ks-api-panel">
              <div><b>FastAPI connection</b><p>Enter your backend base URL to send files for real processing.</p></div>
              <div className="ks-api-controls">
                <input value={api} onChange={event => setApi(event.target.value)} placeholder="http://localhost:8000" />
                <button onClick={() => { setApiOpen(false); setNotice(api.trim() ? 'Backend URL updated.' : 'Backend connection cleared.') }}>Save</button>
              </div>
              <small>Expected endpoints: GET /api/sources, POST /api/sources/upload and POST /api/sources/text.</small>
            </div>
          )}

          <div className="ks-stat-row">
            <div className="ks-stat-card"><span><FolderOpen size={17} /></span><small>TOTAL SOURCES</small><strong>{String(items.length).padStart(2, '0')}</strong><em>In this workspace</em></div>
            <div className="ks-stat-card"><span className="green"><CheckCircle2 size={17} /></span><small>PROCESSED</small><strong>{String(ready).padStart(2, '0')}</strong><em>Successfully ingested</em></div>
            <div className="ks-stat-card"><span className="blue"><Sparkles size={17} /></span><small>LOCAL PREVIEW</small><strong>{String(local).padStart(2, '0')}</strong><em>Not sent to backend</em></div>
            <div className="ks-stat-card"><span className="amber"><AlertCircle size={17} /></span><small>NEEDS ATTENTION</small><strong>{String(failed).padStart(2, '0')}</strong><em>Failed uploads</em></div>
          </div>

          <section className="ks-upload-layout">
            <div
              className={`ks-dropzone ${drag ? 'dragging' : ''}`}
              onDragOver={event => { event.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={event => { event.preventDefault(); setDrag(false); void addFiles(event.dataTransfer.files) }}
              onClick={() => input.current?.click()}
            >
              <input
                ref={input}
                type="file"
                hidden
                multiple
                accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.json"
                onClick={event => event.stopPropagation()}
                onChange={event => { if (event.target.files) void addFiles(event.target.files) }}
              />
              <div className="ks-upload-icon"><UploadCloud size={26} /></div>
              <h3>Drop your project files here</h3>
              <p>or <b>browse files</b> from your computer</p>
              <small>PDF, DOCX, TXT, MD, CSV, XLSX, JSON · Multiple files supported</small>
              <div className="ks-drop-bottom"><span><ShieldCheck size={13} /> Private workspace</span><span>Choose a category before uploading</span></div>
            </div>

            <div className="ks-quick-add">
              <div><span><FileText size={18} /></span><b>Add meeting notes</b><p>Paste meeting minutes, decisions or discussion notes directly.</p><button onClick={() => setTextOpen(true)}>Add text <Plus size={14} /></button></div>
              <div><span className="blue"><FileSpreadsheet size={18} /></span><b>Import task records</b><p>Upload CSV or spreadsheet exports from your task tracker.</p><button onClick={() => { setCategory('Task records'); input.current?.click() }}>Choose task file <ArrowUpRight size={14} /></button></div>
            </div>
          </section>

          <div className="ks-category-row">
            <label>Upload as <select value={category} onChange={event => setCategory(event.target.value)}>{categories.filter(item => item !== 'All sources').map(item => <option key={item}>{item}</option>)}</select></label>
            <span>Supported file size depends on backend configuration.</span>
          </div>

          <div className="ks-source-heading">
            <div><h2>All sources <span>{items.length}</span></h2><p>Files and notes added to this project.</p></div>
            <button className="ks-primary-btn" onClick={() => input.current?.click()} disabled={busy}><Plus size={16} /> Add sources</button>
          </div>

          <div className="ks-toolbar">
            <div className="ks-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search files and notes..." /></div>
            <div className="ks-filter-wrap"><select value={filter} onChange={event => setFilter(event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></div>
          </div>

          <div className="ks-source-list">
            {!visible.length ? (
              <div className="ks-empty"><FolderOpen size={25} /><b>{items.length ? 'No matching sources' : 'Your knowledge base starts here'}</b><p>{items.length ? 'Try another search or category.' : 'Upload project documentation or add meeting notes to begin building your project memory.'}</p><button onClick={() => input.current?.click()}>Upload your first source <ArrowUpRight size={14} /></button></div>
            ) : visible.map(item => (
              <article className="ks-source-item" key={item.id}>
                <div className="ks-file-icon">{iconFor(item.name)}</div>
                <div className="ks-file-info"><b>{item.name}</b><span>{item.category} <i /> {sizeLabel(item.size)} <i /> Added {item.date ? new Date(item.date).toLocaleDateString() : 'recently'}</span>{item.detail && <small>{item.detail}</small>}</div>
                <div className={`ks-status ${item.status.toLowerCase().replace(' ', '-')}`}>
                  {item.status === 'Ready' ? <CheckCircle2 size={14} /> : item.status === 'Failed' ? <AlertCircle size={14} /> : item.status === 'Processing' ? <RefreshCw size={14} className="ks-spin" /> : <Clock3 size={14} />}
                  {item.status}
                </div>
                <button className="ks-remove" title="Remove from this page list" onClick={() => setItems(previous => previous.filter(source => source.id !== item.id))}><Trash2 size={15} /></button>
              </article>
            ))}
          </div>

          <div className="ks-ingestion-note"><Sparkles size={16} /><span><b>What happens next?</b> The processing backend extracts text, splits it into traceable chunks and preserves file name, page or section, upload date and access scope for evidence-linked answers.</span></div>
          {notice && <div className="ks-toast"><span>{notice}</span><button onClick={() => setNotice('')}><X size={14} /></button></div>}
        </div>
      </main>

      {textOpen && (
        <div className="ks-modal-backdrop" onClick={() => setTextOpen(false)}>
          <div className="ks-text-modal" onClick={event => event.stopPropagation()}>
            <button className="ks-modal-close" onClick={() => setTextOpen(false)}><X size={18} /></button>
            <div className="ks-eyebrow">KNOWLEDGE SOURCES / MANUAL ENTRY</div>
            <h2>Add project notes</h2>
            <p>Capture a meeting, decision or important context that isn't in a file yet.</p>
            <label>Note title</label>
            <input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Sprint planning – 2 November" />
            <label>Meeting notes or project text</label>
            <textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Paste notes, decisions, blockers and action items here..." rows={7} />
            <div className="ks-modal-actions">
              <button className="ks-outline-btn" onClick={() => setTextOpen(false)}>Cancel</button>
              <button className="ks-primary-btn" onClick={() => void saveText()} disabled={busy}>{busy ? 'Saving...' : 'Save notes'} <ArrowUpRight size={15} /></button>
            </div>
          </div>
        </div>
      )}

      {busy && <div className="ks-busy"><RefreshCw size={15} className="ks-spin" /> Working...</div>}
    </div>
  )
}
