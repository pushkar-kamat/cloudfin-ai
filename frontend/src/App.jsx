import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { api } from './api'
import { authConfigured, confirmSignUp, getSession, signIn, signOut, signUp } from './auth'

const quickQuestions = [
  'What are the core KYC requirements?',
  'What are common AML escalation indicators?',
  'How is credit risk assessed?',
  'What information is required during loan origination?',
  'What is customer due diligence?',
]

function Logo() {
  return <div className="logo-mark" aria-hidden="true"><span>CF</span></div>
}

function AuthCard({ mode }) {
  const nav = useNavigate()
  const [email, setEmail] = useState(localStorage.getItem('cloudfin_pending_email') || '')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      if (mode === 'signup') {
        await signUp(email, password)
        localStorage.setItem('cloudfin_pending_email', email)
        nav('/verify')
      } else if (mode === 'verify') {
        await confirmSignUp(email, code)
        localStorage.removeItem('cloudfin_pending_email')
        nav('/signin')
      } else {
        await signIn(email, password)
        nav('/app')
      }
    } catch (err) { setError(err.message || 'Authentication failed') }
    finally { setBusy(false) }
  }

  const isVerify = mode === 'verify'
  const isSignup = mode === 'signup'
  return <div className="auth-shell">
    <div className="auth-left">
      <div className="brand"><Logo /><div><strong>CloudFin</strong><small>Financial Policy Intelligence</small></div></div>
      <div className="hero-copy">
        <p className="eyebrow">Secure policy intelligence</p>
        <h1>Find policy answers without digging through documents.</h1>
        <p>CloudFin AI combines secure cloud authentication, lightweight retrieval and grounded AI responses for financial-policy questions.</p>
        <div className="trust-row"><span>✓ Source grounded</span><span>✓ Cloud authenticated</span><span>✓ No financial advice</span></div>
      </div>
      <p className="copyright">CloudFin AI · College Cloud Computing MVP</p>
    </div>
    <div className="auth-right">
      <form className="auth-card" onSubmit={submit}>
        <div className="mobile-brand"><Logo /><strong>CloudFin</strong></div>
        <p className="eyebrow">{isSignup ? 'Create account' : isVerify ? 'Verify email' : 'Welcome back'}</p>
        <h2>{isSignup ? 'Get started with CloudFin' : isVerify ? 'Confirm your account' : 'Sign in to CloudFin'}</h2>
        <p className="muted">{isVerify ? 'Enter the verification code sent by AWS Cognito.' : 'Use your approved email and password.'}</p>
        {!authConfigured && <div className="notice">Cognito variables are not configured yet. Add them to <code>frontend/.env</code>.</div>}
        <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" /></label>
        {isVerify ? <label>Verification code<input required value={code} onChange={e=>setCode(e.target.value)} placeholder="123456" /></label> :
          <label>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" /></label>}
        {error && <div className="error">{error}</div>}
        <button className="primary-btn" disabled={busy}>{busy ? 'Please wait…' : isSignup ? 'Create account' : isVerify ? 'Verify account' : 'Sign in'}</button>
        <p className="switch">{isSignup ? <>Already have an account? <a onClick={()=>nav('/signin')}>Sign in</a></> : isVerify ? <>Back to <a onClick={()=>nav('/signin')}>sign in</a></> : <>New to CloudFin? <a onClick={()=>nav('/signup')}>Create account</a></>}</p>
      </form>
    </div>
  </div>
}

function useAuth() {
  const [state, setState] = useState({ loading: true, session: null })
  useEffect(() => { getSession().then(session => setState({ loading: false, session })) }, [])
  return state
}

function loadConversations() {
  try { return JSON.parse(localStorage.getItem('cloudfin_conversations') || '[]') } catch { return [] }
}
function saveConversations(items) { localStorage.setItem('cloudfin_conversations', JSON.stringify(items)) }

function ChatApp() {
  const nav = useNavigate()
  const { loading, session } = useAuth()
  const [conversations, setConversations] = useState(loadConversations)
  const [activeId, setActiveId] = useState(conversations[0]?.id || null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const bottomRef = useRef(null)
  const active = conversations.find(c => c.id === activeId) || null

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [active?.messages?.length, busy])
  useEffect(() => { saveConversations(conversations) }, [conversations])

  if (loading) return <div className="centered">Loading CloudFin…</div>
  if (!session) return <Navigate to="/signin" replace />

  const isAdmin = session.groups.includes('admin')
  function newChat() { setActiveId(null); setMobileMenu(false); setError('') }
  function logout() { signOut(); nav('/signin') }

  async function send(text = message) {
    const q = text.trim(); if (!q || busy) return
    setMessage(''); setBusy(true); setError('')
    const id = active?.id || crypto.randomUUID()
    const existing = active || { id, title: q.slice(0, 44), createdAt: new Date().toISOString(), messages: [] }
    const withUser = { ...existing, messages: [...existing.messages, { role: 'user', content: q }] }
    setActiveId(id)
    setConversations(prev => [withUser, ...prev.filter(c=>c.id!==id)])
    try {
      const res = await api.chat(session.token, q)
      const done = { ...withUser, messages: [...withUser.messages, { role: 'assistant', content: res.answer, sources: res.sources }] }
      setConversations(prev => [done, ...prev.filter(c=>c.id!==id)])
    } catch (err) {
      if (/expired|token|401/i.test(err.message)) { setError('Your session may have expired. Please sign in again.') }
      else setError(err.message || 'CloudFin is temporarily unavailable. Please try again.')
    } finally { setBusy(false) }
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
      <div className="brand sidebar-brand"><Logo/><div><strong>CloudFin</strong><small>Financial Policy Intelligence</small></div></div>
      <button className="new-chat" onClick={newChat}>＋ New chat</button>
      <div className="side-label">Recent conversations</div>
      <div className="history">
        {conversations.length===0 && <p className="side-empty">Your conversations will appear here.</p>}
        {conversations.map(c => <button key={c.id} className={c.id===activeId?'history-item active':'history-item'} onClick={()=>{setActiveId(c.id);setMobileMenu(false)}}>
          <span>{c.title}</span><small>{new Date(c.createdAt).toLocaleDateString()}</small>
        </button>)}
      </div>
      <div className="profile">
        <div className="avatar">{session.email[0]?.toUpperCase()}</div><div className="profile-text"><strong>{session.email}</strong><small>{isAdmin?'Administrator':'Authenticated user'}</small></div>
        {isAdmin && <button title="Admin" onClick={()=>nav('/admin')}>⚙</button>}
        <button title="Logout" onClick={logout}>↗</button>
      </div>
    </aside>
    {mobileMenu && <div className="overlay" onClick={()=>setMobileMenu(false)} />}
    <main className="chat-main">
      <header className="topbar"><button className="menu-btn" onClick={()=>setMobileMenu(true)}>☰</button><div><strong>CloudFin AI</strong><span>Grounded policy assistant</span></div><div className="status-dot"><i></i> Ready</div></header>
      <div className="chat-scroll">
        {!active || active.messages.length===0 ? <div className="empty-state">
          <div className="ai-orb">CF</div><p className="eyebrow">Financial policy intelligence</p><h1>Ask CloudFin anything about your policies.</h1>
          <p className="muted wide">Answers are retrieved from the internal policy knowledge base and generated with source attribution.</p>
          <div className="quick-grid">{quickQuestions.slice(0,4).map((q,i)=><button key={q} onClick={()=>send(q)}><span>{['KYC','AML','RISK','LOAN'][i]}</span>{q}</button>)}</div>
        </div> : <div className="messages">
          {active.messages.map((m, idx)=><div key={idx} className={`message ${m.role}`}>
            <div className="msg-avatar">{m.role==='assistant'?'CF':'YOU'}</div><div className="bubble">{m.role==='assistant'?<ReactMarkdown>{m.content}</ReactMarkdown>:<p>{m.content}</p>}
            {m.sources?.length>0 && <div className="sources"><strong>Sources</strong>{m.sources.map(s=><div className="source" key={s.document}><span>▣ {s.document}</span><small>{Math.round(s.relevance*100)}% match</small></div>)}</div>}
            </div></div>)}
          {busy && <div className="message assistant"><div className="msg-avatar">CF</div><div className="bubble thinking"><span></span><span></span><span></span> CloudFin is thinking…</div></div>}
          <div ref={bottomRef}/></div>}
      </div>
      {error && <div className="inline-error">{error}</div>}
      <div className="composer-wrap"><div className="composer"><textarea value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Ask CloudFin about KYC, AML, credit risk…" rows={1}/><button onClick={()=>send()} disabled={busy||!message.trim()}>↑</button></div><small>CloudFin provides policy information, not personalized financial advice.</small></div>
    </main>
  </div>
}

function Admin() {
  const nav=useNavigate(); const {loading,session}=useAuth(); const [data,setData]=useState(null); const [docs,setDocs]=useState([]); const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false)
  const admin=useMemo(()=>session?.groups?.includes('admin'),[session])
  useEffect(()=>{ if(session&&admin){ Promise.all([api.health(),api.sources(session.token)]).then(([h,s])=>{setData(h);setDocs(s.documents)}).catch(e=>setMsg(e.message)) } },[session,admin])
  if(loading) return <div className="centered">Loading…</div>
  if(!session) return <Navigate to="/signin" replace/>
  if(!admin) return <Navigate to="/app" replace/>
  async function reload(){setBusy(true);setMsg('');try{const r=await api.reload(session.token);setData(d=>({...d,...r}));setMsg('Knowledge base refreshed successfully.')}catch(e){setMsg(e.message)}finally{setBusy(false)}}
  return <div className="admin-page"><header><div className="brand"><Logo/><div><strong>CloudFin Administration</strong><small>Knowledge Base</small></div></div><button onClick={()=>nav('/app')}>← Back to chat</button></header><main><div className="admin-hero"><p className="eyebrow">Administration</p><h1>Knowledge Base</h1><p>Review the local policy corpus and rebuild the in-memory TF-IDF index.</p></div><div className="stats"><div><small>Documents</small><strong>{data?.knowledge_documents ?? '—'}</strong></div><div><small>Indexed chunks</small><strong>{data?.knowledge_chunks ?? '—'}</strong></div><div><small>Index status</small><strong className="ready">Ready</strong></div></div><section className="doc-card"><div className="doc-head"><div><h2>Policy documents</h2><p>Repository-backed Markdown knowledge sources.</p></div><button className="primary-btn compact" onClick={reload} disabled={busy}>{busy?'Refreshing…':'Refresh knowledge base'}</button></div>{msg&&<div className="notice">{msg}</div>}<div className="doc-list">{docs.map(d=><div key={d}><span>▣</span><div><strong>{d}</strong><small>Indexed and available for retrieval</small></div><b>Ready</b></div>)}</div></section></main></div>
}

export default function App(){
  return <Routes>
    <Route path="/signin" element={<AuthCard mode="signin"/>}/><Route path="/signup" element={<AuthCard mode="signup"/>}/><Route path="/verify" element={<AuthCard mode="verify"/>}/><Route path="/app" element={<ChatApp/>}/><Route path="/admin" element={<Admin/>}/><Route path="*" element={<Navigate to="/app" replace/>}/>
  </Routes>
}
