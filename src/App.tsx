
import { useEffect, useState } from 'react'
import KnowledgeSources from './KnowledgeSources'
import EvidenceExplorer from './EvidenceExplorer'
import ProjectModules from './ProjectModules'
import {
  ArrowRight, ArrowUpRight, Check, FileText,
  Github, Globe2, LockKeyhole, Menu, Network, Play, ShieldCheck,
  Sparkles, Users, X, Zap, Database, MessageSquareText, Layers3,
  CircleCheck, AlertTriangle, Clock3, UploadCloud, Bell, LogOut,
} from 'lucide-react'

type View =
  | 'home'
  | 'login'
  | 'signup'
  | 'overview'
  | 'sources'
  | 'evidence'
  | 'intelligence'
  | 'handover'
  | 'approval'

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="Handover IQ home">
      <span className="brand-mark"><Network size={17} /></span>
      <span>Handover <b>IQ</b></span>
    </a>
  )
}

function Button({
  children,
  onClick,
  secondary = false,
}: {
  children: React.ReactNode
  onClick?: () => void
  secondary?: boolean
}) {
  return (
    <button
      className={secondary ? 'btn btn-secondary' : 'btn btn-primary'}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function GraphPreview() {
  return (
    <div className="graph-preview">
      <div className="graph-top">
        <span className="live-dot" /> PROJECT DNA
        <span className="graph-label">LIVE KNOWLEDGE MAP</span>
      </div>

      <svg
        className="graph-lines"
        viewBox="0 0 600 300"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M300 150 L130 65 M300 150 L470 65 M300 150 L125 240 M300 150 L475 240 M300 150 L300 35 M300 150 L300 270" />
        <path
          className="line-dash"
          d="M130 65 L300 35 L470 65 M125 240 L300 270 L475 240"
        />
      </svg>

      <div className="graph-node node-center">
        <Network size={20} /><small>PROJECT</small>
      </div>
      <div className="graph-node node-one">
        <Users size={17} /><small>PEOPLE</small>
      </div>
      <div className="graph-node node-two">
        <Layers3 size={17} /><small>MODULES</small>
      </div>
      <div className="graph-node node-three">
        <FileText size={17} /><small>DECISIONS</small>
      </div>
      <div className="graph-node node-four">
        <Zap size={17} /><small>TASKS</small>
      </div>
      <div className="graph-node node-five">
        <Database size={17} /><small>DATA</small>
      </div>
      <div className="graph-node node-six">
        <ShieldCheck size={17} /><small>RISKS</small>
      </div>

      <div className="graph-foot">
        <span><i className="key teal" /> Connected knowledge</span>
        <span><i className="key blue" /> Source evidence</span>
        <span>06 entities connected</span>
      </div>
    </div>
  )
}

function DashboardPreview() {
  return (
    <div className="dashboard-window">
      <div className="window-bar">
        <div className="window-dots"><i /><i /><i /></div>
        <span>app.handoveriq.com / workspace</span>
        <div className="window-live">
          <span className="live-dot" /> LIVE INTELLIGENCE
        </div>
      </div>

      <div className="dash-body">
        <aside className="mini-sidebar">
          <Brand />
          <div className="mini-nav active"><Layers3 /> Overview</div>
          <div className="mini-nav"><Network /> Project DNA</div>
          <div className="mini-nav"><Clock3 /> Timeline</div>
          <div className="mini-nav"><ShieldCheck /> Risk radar</div>
          <div className="mini-nav"><MessageSquareText /> Ask Handover IQ</div>
          <div className="mini-nav"><FileText /> Handover</div>
          <div className="mini-user">
            <span className="avatar">AM</span>
            <span>Alex Morgan<small>Workspace admin</small></span>
          </div>
        </aside>

        <main className="mini-main">
          <div className="mini-heading">
            <div>
              <small>WORKSPACE / PROJECTS</small>
              <h3>
                Handover IQ Demo Project <span className="status">Active</span>
              </h3>
              <p>Your project intelligence, at a glance.</p>
            </div>
            <button className="mini-action"><Bell size={14} /></button>
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <small>KNOWLEDGE COVERAGE</small>
              <strong>86<span>%</span></strong>
              <em className="positive">↑ 12% this month</em>
            </div>
            <div className="stat-card">
              <small>OPEN TASKS</small>
              <strong>14</strong>
              <em>3 need attention</em>
            </div>
            <div className="stat-card">
              <small>DEPENDENCIES</small>
              <strong>05</strong>
              <em>Across 4 modules</em>
            </div>
            <div className="stat-card">
              <small>KNOWLEDGE RISK</small>
              <strong className="amber">Moderate</strong>
              <em>2 areas to review</em>
            </div>
          </div>

          <div className="mini-content-grid">
            <div className="mini-panel">
              <div className="panel-title">
                Project knowledge map
                <span>View all <ArrowUpRight size={12} /></span>
              </div>
              <GraphPreview />
            </div>

            <div className="mini-panel risk-panel">
              <div className="panel-title">
                Knowledge risk
                <span className="risk-tag">2 HIGH</span>
              </div>

              <div className="risk-row">
                <span className="risk-icon red"><AlertTriangle /></span>
                <span>Payment gateway<small>Single contributor dependency</small></span>
                <b className="high">High</b>
              </div>

              <div className="risk-row">
                <span className="risk-icon yellow"><FileText /></span>
                <span>Deployment guide<small>Documentation missing</small></span>
                <b className="medium">Medium</b>
              </div>

              <div className="risk-row">
                <span className="risk-icon green"><CircleCheck /></span>
                <span>Authentication<small>Knowledge documented</small></span>
                <b className="low">Low</b>
              </div>

              <div className="mini-alert">
                <AlertTriangle size={14} />
                Payment knowledge is concentrated in one contributor.
              </div>
            </div>
          </div>

          <div className="activity-panel">
            <div className="panel-title">
              Recent project activity
              <span>See timeline <ArrowUpRight size={12} /></span>
            </div>
            <div className="activity-row">
              <i className="activity-dot teal-bg" />
              <span>Database migration completed<small>Today · Alex Morgan</small></span>
              <b>Completed</b>
            </div>
            <div className="activity-row">
              <i className="activity-dot blue-bg" />
              <span>Payment API integration discussed<small>Yesterday · Team meeting</small></span>
              <b className="pending">In progress</b>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  text,
  number,
}: {
  icon: React.ReactNode
  title: string
  text: string
  number: string
}) {
  return (
    <article className="feature-card">
      <div className="feature-top">
        <span className="feature-icon">{icon}</span>
        <span className="feature-number">{number}</span>
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      <a href="#workflow">Explore capability <ArrowUpRight size={14} /></a>
    </article>
  )
}

function HandoverCard() {
  return (
    <div className="handover-card">
      <div className="handover-head">
        <div>
          <span className="eyebrow">Handover IQ / HANDOVER REPORT</span>
          <h3>Everything Michael needs<br />to continue with confidence.</h3>
        </div>
        <span className="approved"><Check size={12} /> REVIEW READY</span>
      </div>

      <div className="handover-people">
        <div className="person">
          <span className="avatar avatar-blue">AM</span>
          <span><b>Alex Morgan</b><small>Departing · Backend</small></span>
        </div>
        <ArrowRight className="transfer-arrow" />
        <div className="person">
          <span className="avatar avatar-purple">MS</span>
          <span><b>Michael Scott</b><small>Incoming · Backend</small></span>
        </div>
      </div>

      <div className="handover-list">
        <div><Check /> Project overview and architecture <span>Included</span></div>
        <div><Check /> Completed and pending tasks <span>Included</span></div>
        <div><Check /> Technical decisions and context <span>Included</span></div>
        <div><AlertTriangle /> Deployment instructions <em>Needs review</em></div>
      </div>

      <div className="handover-bottom">
        <span><ShieldCheck size={14} /> Evidence-linked report</span>
        <span>12 sources connected</span>
      </div>
    </div>
  )
}

function Home({ go }: { go: (v: View) => void }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)

  return (
    <div id="top">
      <header className="site-header">
        <div className="container nav-wrap">
          <Brand />

          <nav className={mobileOpen ? 'nav-links open' : 'nav-links'}>
            <a href="#platform" onClick={() => setMobileOpen(false)}>Platform</a>
            <a href="#intelligence" onClick={() => setMobileOpen(false)}>Intelligence</a>
            <a href="#security" onClick={() => setMobileOpen(false)}>Security</a>
            <a href="#handover" onClick={() => setMobileOpen(false)}>Handover</a>
            <button className="nav-module-link" onClick={() => go('sources')}>
              Knowledge Sources
            </button>
          </nav>

          <div className="nav-actions">
            <button className="login-link" onClick={() => go('login')}>Log in</button>
            <Button onClick={() => go('signup')}>
              Start preserving knowledge <ArrowRight size={15} />
            </Button>
          </div>

          <button
            className="mobile-menu"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <main>
        <section className="hero container">
          <div className="hero-copy">
            <div className="eyebrow-pill">
              <span className="live-dot" /> THE LIVING INTELLIGENCE BEHIND EVERY PROJECT
            </div>

            <h1>Your project remembers<br /><span>more than your team can.</span></h1>

            <p>
              Handover IQ connects every decision, contribution and dependency
              into a living project memory — so critical knowledge never walks out the door.
            </p>

            <div className="hero-buttons">
              <Button onClick={() => go('signup')}>
                Build your project memory <ArrowRight size={16} />
              </Button>
              <button className="watch-btn" onClick={() => setDemoOpen(true)}>
                <span><Play size={13} fill="currentColor" /></span>
                Explore the live demo
              </button>
            </div>

            <div className="hero-trust">
              <span><ShieldCheck /> Evidence-linked insights</span>
              <span><LockKeyhole /> Permission-aware</span>
              <span><Sparkles /> AI-powered continuity</span>
            </div>
          </div>

          <div className="hero-dashboard"><DashboardPreview /></div>
        </section>

        <section className="integrations-strip">
          <div className="container integrations-inner">
            <span>CONNECT YOUR PROJECT'S STORY FROM YOUR TOOLS</span>
            <div>
              <b><Github /> GitHub</b>
              <b><Globe2 /> Google Drive</b>
              <b><Layers3 /> Jira</b>
              <b><MessageSquareText /> Slack</b>
              <b><Database /> Notion</b>
              <b><FileText /> Documents</b>
            </div>
          </div>
        </section>

        <section className="section container" id="platform">
          <div className="section-heading">
            <div>
              <span className="eyebrow">01 — PROJECT INTELLIGENCE</span>
              <h2>Projects don't lose files.<br /><span>They lose the story between them.</span></h2>
            </div>
            <p>
              Handover IQ turns scattered project information into connected,
              searchable intelligence that your whole team can understand and act on.
            </p>
          </div>

          <div className="feature-grid">
            <FeatureCard
              number="01"
              icon={<Network />}
              title="See the invisible connections."
              text="Discover how people, decisions, tasks and dependencies connect across your project — not just where files live."
            />
            <FeatureCard
              number="02"
              icon={<Clock3 />}
              title="Understand how you got here."
              text="Reconstruct your project's timeline, uncover why decisions happened and preserve the context behind every milestone."
            />
            <FeatureCard
              number="03"
              icon={<AlertTriangle />}
              title="Spot knowledge risk before it becomes loss."
              text="Find single-person dependencies, undocumented processes and critical knowledge gaps before someone leaves."
            />
          </div>

          <div className="dna-band" id="intelligence">
            <div>
              <span className="eyebrow">PROJECT DNA / CONNECTED MEMORY</span>
              <h3>One project. Every connection.<br /><span>Nothing left behind.</span></h3>
              <p>
                Explore a living map of the people, modules, decisions and tasks
                that make your project work.
              </p>
              <a className="text-link" href="#workflow">
                Discover Project DNA <ArrowRight size={15} />
              </a>
            </div>
            <GraphPreview />
          </div>
        </section>

        <section className="section handover-section" id="handover">
          <div className="container handover-layout">
            <div className="handover-copy">
              <span className="eyebrow">02 — HANDOVER, REIMAGINED</span>
              <h2>Don't hand over a folder.<br /><span>Hand over understanding.</span></h2>
              <p>
                NEXUS builds a role-aware handover from the knowledge your project
                has already created — so the next person can move forward, not start over.
              </p>
              <ul>
                <li><Check /> Every task and decision has context.</li>
                <li><Check /> Every critical insight links to evidence.</li>
                <li><Check /> Every next step is clearly prioritised.</li>
              </ul>
              <a className="text-link" href="#workflow">
                Explore the handover workflow <ArrowRight size={15} />
              </a>
            </div>
            <HandoverCard />
          </div>
        </section>

        <section className="section container" id="security">
          <div className="section-heading security-heading">
            <div>
              <span className="eyebrow">03 — TRUST BUILT IN</span>
              <h2>Intelligence without<br /><span>compromising access.</span></h2>
            </div>
            <p>
              Project memory should be useful, accountable and secure.
              Handover IQ keeps access controls and evidence at the centre of every handover.
            </p>
          </div>

          <div className="security-grid">
            <div>
              <LockKeyhole />
              <h3>Permission-aware</h3>
              <p>Respect project roles and source permissions. People only see what they are authorised to access.</p>
            </div>
            <div>
              <ShieldCheck />
              <h3>Evidence before confidence</h3>
              <p>Trace important AI-generated statements back to the original source and flag uncertainty clearly.</p>
            </div>
            <div>
              <Users />
              <h3>Human in the loop</h3>
              <p>Review, edit and approve handovers before knowledge is shared with the next owner.</p>
            </div>
          </div>
        </section>

        <section className="section container" id="workflow">
          <div className="workflow-box">
            <div>
              <span className="eyebrow">04 — YOUR PROJECT, STILL MOVING</span>
              <h2>Make sure it has a future.</h2>
              <p>From scattered information to a confident handover. Keep your team's knowledge moving forward.</p>
              <Button onClick={() => go('signup')}>
                Start preserving knowledge <ArrowRight size={16} />
              </Button>
            </div>

            <div className="workflow-steps">
              <div><span>01</span><b>Connect</b><small>Bring project sources together</small></div>
              <div><span>02</span><b>Understand</b><small>Reconstruct context and decisions</small></div>
              <div><span>03</span><b>Protect</b><small>Identify knowledge risks</small></div>
              <div><span>04</span><b>Continue</b><small>Generate an actionable handover</small></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-top">
          <div>
            <Brand />
            <p>The living intelligence behind every project.</p>
          </div>
          <div className="footer-links">
            <div>
              <b>Product</b>
              <a href="#platform">Platform</a>
              <a href="#intelligence">Project DNA</a>
              <a href="#handover">Handover</a>
            </div>
            <div>
              <b>Company</b>
              <a href="#security">Security</a>
              <a href="mailto:hello@handoveriq.example">Contact</a>
              <a href="#top">About Handover IQ</a>
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 Handover IQ. Built for knowledge continuity.</span>
          <span>Privacy-first · Evidence-led · Human-approved</span>
        </div>
      </footer>

      {demoOpen && (
        <div className="modal-backdrop" onClick={() => setDemoOpen(false)}>
          <div className="demo-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDemoOpen(false)}>
              <X />
            </button>
            <span className="eyebrow">Handover IQ / PRODUCT TOUR</span>
            <h2>See how project memory works.</h2>
            <p>
              This interactive preview demonstrates the core NEXUS workflow:
              connect sources, reconstruct project knowledge, identify risks
              and prepare a role-specific handover.
            </p>
            <div className="demo-modal-steps">
              <span><UploadCloud /> Connect sources</span>
              <span><Network /> Map knowledge</span>
              <span><ShieldCheck /> Verify evidence</span>
              <span><FileText /> Create handover</span>
            </div>
            <Button onClick={() => { setDemoOpen(false); go('signup') }}>
              Explore Handover IQ <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function WorkspaceOverview({ go }: { go: (view: View) => void }) {
  const teamName = localStorage.getItem('nexus_team_name') || 'Your workspace'
  const email = localStorage.getItem('nexus_email') || ''

  const modules = [
    {
      title: 'Knowledge Sources',
      description: 'Upload and manage your project documents and information.',
      icon: <FileText />,
      view: 'sources' as View,
      number: '01',
    },
    {
      title: 'Evidence Explorer',
      description: 'Explore claims and verify them using supporting evidence.',
      icon: <ShieldCheck />,
      view: 'evidence' as View,
      number: '02',
    },
    {
      title: 'AI Intelligence',
      description: 'Discover project insights and connected knowledge.',
      icon: <Network />,
      view: 'intelligence' as View,
      number: '03',
    },
    {
      title: 'Handover Generator',
      description: 'Generate a structured handover for the next team member.',
      icon: <Layers3 />,
      view: 'handover' as View,
      number: '04',
    },
  ]

  return (
    <div className="overview-page">
      <header className="overview-header">
        <Brand />

        <div className="overview-user">
          <span className="overview-avatar">
            {email ? email.charAt(0).toUpperCase() : 'U'}
          </span>
          <div>
            <b>{teamName}</b>
            <small>{email || 'Workspace'}</small>
          </div>
        </div>
      </header>

      <main className="overview-content">
        <div className="overview-heading">
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>Welcome to <span>Handover IQ.</span></h1>
          <p>
            Your project's knowledge, evidence and intelligence in one place.
            Choose a module to get started.
          </p>
        </div>

        <div className="overview-section-title">
          <div>
            <h2>Workspace Modules</h2>
            <p>Everything you need to preserve project knowledge.</p>
          </div>
          <span className="overview-count">04 MODULES</span>
        </div>

        <div className="overview-grid">
          {modules.map(module => (
            <button
              className="overview-card"
              key={module.number}
              onClick={() => go(module.view)}
            >
              <div className="overview-card-top">
                <span className="overview-card-icon">{module.icon}</span>
                <span className="overview-card-number">{module.number}</span>
              </div>

              <h3>{module.title}</h3>
              <p>{module.description}</p>

              <div className="overview-card-link">
                Open module <ArrowUpRight size={15} />
              </div>
            </button>
          ))}
        </div>

        <div className="overview-footer">
          <ShieldCheck size={16} />
          <span>Your project knowledge, preserved and connected.</span>
        </div>
      </main>
    </div>
  )
}

function Auth({
  mode,
  go,
}: {
  mode: 'login' | 'signup'
  go: (v: View) => void
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [teamName, setTeamName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState(false)

  const isSignup = mode === 'signup'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setNotice('')
    setBusy(true)

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

      const response = await fetch(
        `${apiBase}/api/auth/${isSignup ? 'register' : 'login'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isSignup
              ? { email, password, team_name: teamName }
              : { email, password }
          ),
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.detail || `Authentication failed (${response.status}).`)
      }

      if (!data.access_token) {
        throw new Error('The server did not return an access token.')
      }

      if (inviteCode.trim() && !isSignup) {
        const joined = await fetch(`${apiBase}/api/teams/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.access_token}`,
          },
          body: JSON.stringify({ invite_code: inviteCode.trim() }),
        })

        const joinedData = await joined.json()

        if (!joined.ok) {
          throw new Error(joinedData.detail || 'Could not join team.')
        }

        data.teams = joinedData.teams
      }

      if (!Array.isArray(data.teams) || data.teams.length === 0) {
        throw new Error('Your account is not connected to a team yet.')
      }

      const team = data.teams[0]

      if (!team.project_id) {
        throw new Error('The selected team does not have a project ID.')
      }

      localStorage.setItem('nexus_token', data.access_token)
      localStorage.setItem('nexus_project_id', String(team.project_id))
      localStorage.setItem('nexus_team_id', String(team.team_id ?? ''))
      localStorage.setItem('nexus_team_name', String(team.name ?? 'Workspace'))
      localStorage.setItem('nexus_email', String(data.user?.email ?? email))

      if (isSignup) {
        window.alert(
          `Workspace created! Share this invitation code with teammates: ${team.invite_code}`
        )
      }

      go('sources')
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : 'Could not connect to the NEXUS API.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-left">
        <Brand />

        <div className="auth-intro">
          <span className="eyebrow">{isSignup ? 'WELCOME ABOARD' : 'WELCOME BACK'}</span>
          <h1>Your project's<br />intelligence,<br /><span>all in one place.</span></h1>
          <p>
            Handover IQ preserves the decisions, context and connections
            your team needs to keep moving.
          </p>
        </div>

        <div className="auth-foot">
          © 2026 Handover IQ
          <span>Privacy-first project memory</span>
        </div>
      </section>

      <section className="auth-right">
        <button className="back-home" onClick={() => go('home')}>
          ← Back to home
        </button>

        <div className="auth-form-wrap">
          <div className="auth-form-heading">
            <span className="eyebrow">
              {isSignup ? 'CREATE YOUR WORKSPACE' : 'YOUR PROJECT HAS A MEMORY'}
            </span>

            <h2>
              {isSignup ? 'Start with what you know.' : 'Every project has a memory.'}
              <br />
              <span>
                {isSignup ? 'Build what comes next.' : 'Make sure nothing gets lost.'}
              </span>
            </h2>

            <p>
              {isSignup
                ? 'Create your NEXUS workspace and give your project a memory.'
                : 'Sign in to continue to your NEXUS workspace.'}
            </p>
          </div>

          <form onSubmit={submit}>
            <label>Email address</label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />

            {isSignup && (
              <>
                <label>Team / workspace name</label>
                <input
                  type="text"
                  placeholder="e.g. Team Alpha"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  required
                />
              </>
            )}

            {!isSignup && (
              <>
                <label>Team invitation code (optional)</label>
                <input
                  type="text"
                  placeholder="Enter code to join a teammate's workspace"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                />
              </>
            )}

            <label>Password</label>
            <div className="password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            {!isSignup && (
              <div className="form-options">
                <label className="remember">
                  <input type="checkbox" /> Remember me
                </label>
                <a href="mailto:support@handoveriq.example">Forgot password?</a>
              </div>
            )}

            <button className="btn btn-primary auth-submit" type="submit">
              {busy
                ? 'Please wait…'
                : isSignup
                  ? 'Create Handover IQ workspace'
                  : 'Sign in to Handover IQ'}
              <ArrowRight size={15} />
            </button>

            <button
              className="google-btn"
              type="button"
              onClick={() =>
                setNotice('Google OAuth is not configured yet. Use email and password for now.')
              }
            >
              <span>G</span> Continue with Google
            </button>

            {notice && <div className="form-notice">{notice}</div>}
          </form>

          <div className="auth-switch">
            {isSignup ? 'Already have a workspace?' : 'New to NEXUS?'}
            {' '}
            <button onClick={() => go(isSignup ? 'login' : 'signup')}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </div>

          <div className="auth-legal">
            By continuing, you agree to our <a href="#terms">Terms</a> and{' '}
            <a href="#privacy">Privacy Policy</a>.
          </div>
        </div>
      </section>
    </div>
  )
}

function getViewFromHash(): View {
  const value = window.location.hash.replace(/^#/, '')

  const validViews: View[] = [
    'home',
    'login',
    'signup',
    'overview',
    'sources',
    'evidence',
    'intelligence',
    'handover',
    'approval',
  ]

  return validViews.includes(value as View) ? (value as View) : 'home'
}

export default function App() {
  const [view, setView] = useState<View>(getViewFromHash)

  useEffect(() => {
    const handleHistoryChange = () => setView(getViewFromHash())

    window.addEventListener('popstate', handleHistoryChange)
    window.addEventListener('hashchange', handleHistoryChange)

    return () => {
      window.removeEventListener('popstate', handleHistoryChange)
      window.removeEventListener('hashchange', handleHistoryChange)
    }
  }, [])

  function navigate(next: View) {
    setView(next)

    const nextHash = next === 'home' ? '#top' : `#${next}`

    if (window.location.hash !== nextHash) {
      window.history.pushState({ view: next }, '', nextHash)
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function logout() {
    localStorage.removeItem('nexus_token')
    localStorage.removeItem('nexus_project_id')
    localStorage.removeItem('nexus_team_id')
    localStorage.removeItem('nexus_team_name')
    localStorage.removeItem('nexus_email')

    navigate('home')
  }

  const withLogout = (content: React.ReactNode) => (
  <div className="app-layout">
    <aside className="common-sidebar">
      {/* Keep your existing sidebar content here */}

      <button className="common-logout" onClick={logout}>
        <LogOut size={18} />
        <span>Logout</span>
      </button>
    </aside>

    <main className="app-main">
      {content}
    </main>
  </div>
);

  // Public pages
  if (view === 'home') {
    return <Home go={navigate} />
  }

  if (view === 'login' || view === 'signup') {
    return <Auth mode={view} go={navigate} />
  }

  // Authenticated workspace pages
  if (view === 'overview') {
    return withLogout(
      <WorkspaceOverview go={navigate} />
    )
  }

  if (view === 'sources') {
    return withLogout(
      <KnowledgeSources
        onBack={() => navigate('overview')}
        onEvidence={() => navigate('evidence')}
        onModules={() => navigate('intelligence')}
      />
    )
  }

  if (view === 'evidence') {
    return withLogout(
      <EvidenceExplorer
        onBack={() => navigate('sources')}
        onModules={() => navigate('intelligence')}
      />
    )
  }

 return withLogout(
  <ProjectModules
    onBack={() => navigate('overview')}
    onLogout={logout}
    initialTab={
      view === 'handover'
        ? 'generator'
        : view === 'approval'
          ? 'approval'
          : 'intelligence'
    }
  />
)
}
