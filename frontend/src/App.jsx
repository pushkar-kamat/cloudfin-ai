import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import {
  Archive, ArrowLeft, ArrowUp, Bot, Check, ChevronDown, ChevronRight,
  CircleGauge, Database, FileSearch, FileText, FolderOpen, LogOut, Menu,
  MessageSquare, Mic, MoreHorizontal, Moon, PanelLeftClose, PanelLeftOpen,
  Pin, Plus, RefreshCw, Search, Settings, Shield, Sparkles, Sun, Trash2,
  Upload, User, X, Pencil, RotateCcw, Cloud, LockKeyhole, Gauge, Eye, EyeOff, KeyRound, Mail,
} from 'lucide-react'
import { api } from './api'
import { authConfigured, getSession, requestPasswordReset, signIn, signOut, signUp, subscribeAuth, updatePassword } from './auth'

const quickQuestions = [
  ['KYC', 'What are the core KYC requirements?'],
  ['AML', 'What are common AML escalation indicators?'],
  ['RISK', 'How is credit risk assessed?'],
  ['LOAN', 'What information is required during loan origination?'],
]

function BrandMark({ compact = false }) {
  return <div className={`brand-mark ${compact ? 'compact' : ''}`} aria-hidden="true">
    <Cloud size={compact ? 17 : 20}/><span className="brand-pulse" />
  </div>
}

function AuthBackdrop() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    let frame = 0
    let points = []
    const mouse = { x: -1000, y: -1000 }
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.min(150, Math.max(80, Math.floor((window.innerWidth * window.innerHeight) / 11000)))
      points = Array.from({ length: count }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - .5) * .18,
        vy: (Math.random() - .5) * .18,
        r: Math.random() * 1.4 + .45,
        a: Math.random() * .28 + .08,
      }))
    }
    const move = (e) => { mouse.x = e.clientX; mouse.y = e.clientY }
    const leave = () => { mouse.x = -1000; mouse.y = -1000 }
    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      for (const p of points) {
        const dx = mouse.x - p.x; const dy = mouse.y - p.y
        const dist = Math.hypot(dx, dy)
        if (dist < 180 && dist > 0) {
          p.vx -= (dx / dist) * .012 * (1 - dist / 180)
          p.vy -= (dy / dist) * .012 * (1 - dist / 180)
        }
        p.vx *= .995; p.vy *= .995; p.x += p.vx; p.y += p.vy
        if (p.x < -5) p.x = window.innerWidth + 5
        if (p.x > window.innerWidth + 5) p.x = -5
        if (p.y < -5) p.y = window.innerHeight + 5
        if (p.y > window.innerHeight + 5) p.y = -5
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(178, 211, 205, ${p.a})`; ctx.fill()
      }
      frame = requestAnimationFrame(draw)
    }
    resize(); draw()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseleave', leave)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); window.removeEventListener('mousemove', move); window.removeEventListener('mouseleave', leave) }
  }, [])
  return <canvas ref={canvasRef} className="auth-particles" aria-hidden="true" />
}

function PasswordField({ label, value, onChange, autoComplete, placeholder = '••••••••', required = true, minLength = 8 }) {
  const [visible, setVisible] = useState(false)
  return <label className="field">
    <span>{label}</span>
    <div className="password-field-wrap">
      <input
        type={visible ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <button type="button" className="password-toggle" onClick={()=>setVisible(v=>!v)} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
        {visible ? <EyeOff size={17}/> : <Eye size={17}/>}
      </button>
    </div>
  </label>
}

function AuthCard({ mode }) {
  const nav = useNavigate()
  const [email, setEmail] = useState(localStorage.getItem('cloudfin_pending_email') || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const isSignup = mode === 'signup'

  async function submit(e) {
    e.preventDefault(); setError(''); setSuccess('')
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setBusy(true)
    try {
      if (isSignup) {
        const data = await signUp(email, password)
        if (data.session) nav('/app')
        else {
          localStorage.setItem('cloudfin_pending_email', email)
          setSuccess('Account created successfully. Check your email to confirm your account, then sign in.')
        }
      } else {
        await signIn(email, password); nav('/app')
      }
    } catch (err) { setError(err.message || 'Authentication failed') }
    finally { setBusy(false) }
  }

  return <div className="auth-shell">
    <AuthBackdrop />
    <div className="auth-grid" aria-hidden="true" />
    <div className="auth-brand-corner"><BrandMark/><div><strong>CloudFin</strong><span>Financial Policy Intelligence</span></div></div>
    <main className="auth-card-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-card-mark"><BrandMark /></div>
        <p className="auth-kicker">{isSignup ? 'CREATE ACCOUNT' : 'SECURE ACCESS'}</p>
        <h1>{isSignup ? 'Join CloudFin' : 'Welcome back'}</h1>
        <p className="auth-intro">Enterprise financial policy intelligence, grounded in your organization’s knowledge base.</p>
        {!authConfigured && <div className="notice">Supabase variables are not configured in <code>frontend/.env</code>.</div>}
        <label className="field"><span>Email</span><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" /></label>
        <PasswordField label="Password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={isSignup ? 'new-password' : 'current-password'} />
        <PasswordField label="Confirm password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete={isSignup ? 'new-password' : 'off'} />
        {!isSignup && <div className="auth-help-row"><button type="button" onClick={()=>nav('/forgot-password')}>Forgot password?</button></div>}
        {success && <div className="form-success auth-success"><Check size={16}/><span>{success}</span></div>}
        {error && <div className="form-error">{error}</div>}
        <button className="auth-submit" disabled={busy}>{busy ? <><span className="button-spinner"/>Please wait</> : isSignup ? 'Create account' : 'Sign in'}</button>
        <p className="auth-switch">{isSignup ? <>Already have an account? <button type="button" onClick={()=>nav('/signin')}>Sign in</button></> : <>New to CloudFin? <button type="button" onClick={()=>nav('/signup')}>Create account</button></>}</p>
      </form>
    </main>
    <footer className="auth-footer">CloudFin AI · Lightweight Enterprise RAG · Vercel + Render</footer>
  </div>
}

function ForgotPasswordCard() {
  const nav = useNavigate()
  const [email, setEmail] = useState(localStorage.getItem('cloudfin_pending_email') || '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      await requestPasswordReset(email)
      localStorage.setItem('cloudfin_pending_email', email)
      setMessage('Password reset email sent. Open the link in your email to choose a new password.')
    } catch (err) { setError(err.message || 'Could not send the reset email.') }
    finally { setBusy(false) }
  }

  return <div className="auth-shell">
    <AuthBackdrop /><div className="auth-grid" aria-hidden="true" />
    <div className="auth-brand-corner"><BrandMark/><div><strong>CloudFin</strong><span>Financial Policy Intelligence</span></div></div>
    <main className="auth-card-wrap"><form className="auth-card" onSubmit={submit}>
      <div className="auth-card-mark"><div className="auth-action-icon"><Mail size={20}/></div></div>
      <p className="auth-kicker">ACCOUNT RECOVERY</p><h1>Reset your password</h1>
      <p className="auth-intro">Enter your CloudFin account email and we’ll send you a secure password-reset link.</p>
      <label className="field"><span>Email</span><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" /></label>
      {message && <div className="form-success">{message}</div>}{error && <div className="form-error">{error}</div>}
      <button className="auth-submit" disabled={busy}>{busy ? <><span className="button-spinner"/>Sending…</> : 'Send reset link'}</button>
      <p className="auth-switch"><button type="button" onClick={()=>nav('/signin')}>← Back to sign in</button></p>
      <div className="auth-trust"><span><LockKeyhole size={13}/> Supabase Auth</span><span><Shield size={13}/> Secure recovery</span></div>
    </form></main>
    <footer className="auth-footer">CloudFin AI · Lightweight Enterprise RAG · Vercel + Render</footer>
  </div>
}

function ResetPasswordCard() {
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault(); setError('')
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setBusy(true)
    try {
      await updatePassword(password)
      await signOut()
      nav('/signin', { replace: true })
    } catch (err) { setError(err.message || 'Could not update the password. Open the latest recovery link and try again.') }
    finally { setBusy(false) }
  }

  return <div className="auth-shell">
    <AuthBackdrop /><div className="auth-grid" aria-hidden="true" />
    <div className="auth-brand-corner"><BrandMark/><div><strong>CloudFin</strong><span>Financial Policy Intelligence</span></div></div>
    <main className="auth-card-wrap"><form className="auth-card" onSubmit={submit}>
      <div className="auth-card-mark"><div className="auth-action-icon"><KeyRound size={20}/></div></div>
      <p className="auth-kicker">SECURE RECOVERY</p><h1>Choose a new password</h1>
      <p className="auth-intro">Create a new password for your CloudFin account. Use at least 8 characters.</p>
      <PasswordField label="New password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" />
      <PasswordField label="Confirm new password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" />
      {error && <div className="form-error">{error}</div>}
      <button className="auth-submit" disabled={busy}>{busy ? <><span className="button-spinner"/>Updating…</> : 'Update password'}</button>
      <p className="auth-switch"><button type="button" onClick={()=>nav('/signin')}>← Back to sign in</button></p>
      <div className="auth-trust"><span><LockKeyhole size={13}/> Encrypted session</span><span><Shield size={13}/> Protected account</span></div>
    </form></main>
    <footer className="auth-footer">CloudFin AI · Lightweight Enterprise RAG · Vercel + Render</footer>
  </div>
}

function useAuth() {
  const [state, setState] = useState({ loading: true, session: null })
  useEffect(() => {
    let mounted = true
    getSession().then(session => { if (mounted) setState({ loading: false, session }) })
    const unsubscribe = subscribeAuth(session => { if (mounted) setState({ loading: false, session }) })
    return () => { mounted = false; unsubscribe() }
  }, [])
  return state
}

function useAppearance() {
  const [appearance, setAppearance] = useState(() => localStorage.getItem('cloudfin_appearance') || 'dark')
  useEffect(() => {
    localStorage.setItem('cloudfin_appearance', appearance)
    if (appearance === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', appearance)
  }, [appearance])
  return [appearance, setAppearance]
}

function normalizeConversation(item) {
  return {
    id: item.id || crypto.randomUUID(), title: item.title || 'Untitled chat',
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
    pinned: Boolean(item.pinned), archived: Boolean(item.archived),
    messages: Array.isArray(item.messages) ? item.messages : [],
  }
}
function loadConversations() { try { return JSON.parse(localStorage.getItem('cloudfin_conversations') || '[]').map(normalizeConversation) } catch { return [] } }
function saveConversations(items) { localStorage.setItem('cloudfin_conversations', JSON.stringify(items)) }

function ActionDialog({ open, title, description, confirmLabel='Confirm', destructive=false, inputValue, onInputChange, onConfirm, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = e => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose?.()}}>
    <section className="modal-card" role="dialog" aria-modal="true">
      <div className={`modal-icon ${destructive?'danger':''}`}>{destructive?<Trash2 size={19}/>:<Pencil size={19}/>}</div>
      <h3>{title}</h3><p>{description}</p>
      {inputValue !== undefined && <input className="modal-input" autoFocus value={inputValue} onChange={e=>onInputChange?.(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&inputValue.trim()){e.preventDefault();onConfirm?.()}}}/>}
      <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Cancel</button><button className={`btn ${destructive?'danger':'primary'}`} onClick={onConfirm} disabled={inputValue!==undefined&&!inputValue.trim()}>{confirmLabel}</button></div>
    </section>
  </div>
}

function SourceList({ sources=[] }) {
  if (!sources.length) return null
  return <div className="source-stack"><div className="source-stack-title"><FileSearch size={14}/> Sources <span>{sources.length}</span></div>{sources.map((s,i)=><details className="source-card" key={`${s.document}-${s.section}-${s.page}-${i}`}>
    <summary><div><FileText size={15}/><span>{s.document}</span></div><div className="source-score">{Math.round((s.relevance||0)*100)}%</div></summary>
    <div className="source-body"><div className="source-meta">{s.section&&<span>Section: {s.section}</span>}{s.page&&<span>Page {s.page}</span>}<span>{s.origin==='runtime'?'Uploaded':'Core'} source</span></div><p>{s.excerpt}</p></div>
  </details>)}</div>
}

function ConversationRow({ chat, active, onSelect, onRename, onDelete, onArchive, onPin }) {
  const [open, setOpen] = useState(false)
  return <div className={`conversation-row ${active?'active':''}`}>
    <button className="conversation-main" onClick={()=>onSelect(chat.id)}><MessageSquare size={15}/><span>{chat.title}</span>{chat.pinned&&<Pin size={12} className="pin-mini"/>}</button>
    <button className="conversation-more" onClick={()=>setOpen(v=>!v)} aria-label="Conversation actions"><MoreHorizontal size={16}/></button>
    {open&&<div className="conversation-menu" onMouseLeave={()=>setOpen(false)}>
      <button onClick={()=>{onPin(chat.id);setOpen(false)}}><Pin size={14}/>{chat.pinned?'Unpin':'Pin'}</button>
      <button onClick={()=>{onRename(chat.id);setOpen(false)}}><Pencil size={14}/>Rename</button>
      <button onClick={()=>{onArchive(chat.id);setOpen(false)}}><Archive size={14}/>{chat.archived?'Restore':'Archive'}</button>
      <button className="danger-text" onClick={()=>{onDelete(chat.id);setOpen(false)}}><Trash2 size={14}/>Delete</button>
    </div>}
  </div>
}

function SettingsPanel({ open, onClose, session, appearance, setAppearance, backend }) {
  if (!open) return null
  return <div className="drawer-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}><aside className="settings-drawer">
    <div className="drawer-head"><div><span className="section-kicker">SETTINGS</span><h2>CloudFin preferences</h2></div><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>
    <section className="settings-section"><h3>Account</h3><div className="account-card"><div className="account-avatar">{session.email.slice(0,1).toUpperCase()}</div><div><strong>{session.email}</strong><span>Authenticated with Supabase</span></div></div></section>
    <section className="settings-section"><h3>Appearance</h3><div className="appearance-grid">
      {[['dark','Dark',Moon],['light','Light',Sun],['system','System',CircleGauge]].map(([value,label,Icon])=><button key={value} className={appearance===value?'selected':''} onClick={()=>setAppearance(value)}><Icon size={17}/><span>{label}</span>{appearance===value&&<Check size={14}/>}</button>)}
    </div></section>
    <section className="settings-section"><h3>System</h3><div className="mini-status"><span>Backend</span><b>{backend==='ready'?'Connected':backend==='waking'?'Waking up':'Checking'}</b></div><div className="mini-status"><span>Conversation storage</span><b>Browser localStorage</b></div></section>
  </aside></div>
}

function ChatApp() {
  const nav = useNavigate()
  const { loading, session } = useAuth()
  const [appearance, setAppearance] = useAppearance()
  const [conversations, setConversations] = useState(loadConversations)
  // Always start on a fresh chat after sign-in/reload. Previous conversations remain
  // available in the sidebar and open only when the user selects one.
  const [activeId,setActiveId]=useState(null)
  const [message,setMessage]=useState('')
  const [search,setSearch]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [sidebarOpen,setSidebarOpen]=useState(true)
  const [mobileOpen,setMobileOpen]=useState(false)
  const [archivedOpen,setArchivedOpen]=useState(false)
  const [settingsOpen,setSettingsOpen]=useState(false)
  const [accountOpen,setAccountOpen]=useState(false)
  const [backendStatus,setBackendStatus]=useState('checking')
  const [isAdmin,setIsAdmin]=useState(false)
  const [dialog,setDialog]=useState(null)
  const [renameValue,setRenameValue]=useState('')
  const [listening,setListening]=useState(false)
  const chatRef=useRef(null)
  const recognitionRef=useRef(null)
  const active=conversations.find(c=>c.id===activeId)||null

  useEffect(()=>{saveConversations(conversations)},[conversations])
  useEffect(()=>{api.health().then(()=>setBackendStatus('ready')).catch(()=>setBackendStatus('waking'))},[])
  useEffect(()=>{if(session?.token)api.me(session.token).then(p=>setIsAdmin(Boolean(p.is_admin))).catch(()=>setIsAdmin(false));else setIsAdmin(false)},[session?.token])
  useEffect(()=>{const n=chatRef.current;if(n)requestAnimationFrame(()=>n.scrollTo({top:n.scrollHeight,behavior:'smooth'}))},[active?.messages?.length,busy])

  const visible=useMemo(()=>conversations.filter(c=>c.archived===archivedOpen&&c.title.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||new Date(b.updatedAt)-new Date(a.updatedAt)),[conversations,search,archivedOpen])
  const pinned=visible.filter(c=>c.pinned), recent=visible.filter(c=>!c.pinned)

  if(loading)return <div className="full-loader"><BrandMark/><span>Loading CloudFin…</span></div>
  if(!session)return <Navigate to="/signin" replace/>

  const patchChat=(id,patch)=>setConversations(prev=>prev.map(c=>c.id===id?{...c,...patch,updatedAt:new Date().toISOString()}:c))
  const newChat=()=>{setActiveId(null);setMobileOpen(false);setError('')}
  const renameChat=id=>{const c=conversations.find(x=>x.id===id);setRenameValue(c?.title||'');setDialog({type:'rename',id})}
  const deleteChat=id=>setDialog({type:'delete',id})
  const archiveChat=id=>{patchChat(id,{archived:!conversations.find(c=>c.id===id)?.archived});if(activeId===id)setActiveId(null)}
  const pinChat=id=>patchChat(id,{pinned:!conversations.find(c=>c.id===id)?.pinned})
  const closeDialog=()=>{setDialog(null);setRenameValue('')}
  const confirmDialog=()=>{if(!dialog)return;if(dialog.type==='rename'){const t=renameValue.trim();if(!t)return;patchChat(dialog.id,{title:t})}else{setConversations(prev=>prev.filter(c=>c.id!==dialog.id));if(activeId===dialog.id)setActiveId(null)}closeDialog()}
  const logout=async()=>{await signOut();nav('/signin')}

  async function send(text=message){
    const q=text.trim();if(!q||busy)return
    setBusy(true);setMessage('');setError('')
    const id=active?.id||crypto.randomUUID()
    const existing=active||{id,title:q.slice(0,52),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),pinned:false,archived:false,messages:[]}
    const userMsg={role:'user',content:q}
    const history=existing.messages.slice(-4).map(m=>({role:m.role,content:m.content}))
    setConversations(prev=>active?prev.map(c=>c.id===id?{...c,messages:[...c.messages,userMsg],updatedAt:new Date().toISOString()}:c):[{...existing,messages:[userMsg]},...prev])
    setActiveId(id)
    try{
      const result=await api.chat(session.token,q,history)
      const assistant={role:'assistant',content:result.answer,sources:result.sources||[],cached:result.cached,provider:result.provider,fallback_used:result.fallback_used}
      setConversations(prev=>prev.map(c=>c.id===id?{...c,messages:[...c.messages,assistant],updatedAt:new Date().toISOString()}:c))
    }catch(e){setError(e.message||'CloudFin could not generate a response.')}
    finally{setBusy(false)}
  }

  function toggleVoice(){
    if(listening){recognitionRef.current?.stop();return}
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition
    if(!SpeechRecognition){setError('Voice input is not supported in this browser.');return}
    const recognition=new SpeechRecognition();recognition.lang='en-IN';recognition.interimResults=true;recognition.continuous=false
    const base=message.trim();recognition.onstart=()=>setListening(true);recognition.onend=()=>setListening(false);recognition.onerror=()=>setListening(false)
    recognition.onresult=e=>{let t='';for(let i=e.resultIndex;i<e.results.length;i++)t+=e.results[i][0].transcript;setMessage([base,t.trim()].filter(Boolean).join(' '))}
    recognitionRef.current=recognition;recognition.start()
  }

  const sidebarContent=<>
    <div className="sidebar-head"><div className="sidebar-brand"><BrandMark compact/><div><strong>CloudFin</strong><span>Financial Policy Intelligence</span></div></div><button className="icon-btn" onClick={()=>{setSidebarOpen(false);setMobileOpen(false)}}><PanelLeftClose size={18}/></button></div>
    <button className="new-chat-btn" onClick={newChat}><Plus size={17}/>New chat</button>
    <div className="sidebar-search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={archivedOpen?'Search archive':'Search conversations'}/></div>
    <div className="conversation-list">
      {pinned.length>0&&<div className="conversation-group"><span className="group-label">Pinned</span>{pinned.map(c=><ConversationRow key={c.id} chat={c} active={activeId===c.id} onSelect={id=>{setActiveId(id);setMobileOpen(false)}} onRename={renameChat} onDelete={deleteChat} onArchive={archiveChat} onPin={pinChat}/>)}</div>}
      <div className="conversation-group"><span className="group-label">{archivedOpen?'Archived':'Recent'}</span>{recent.map(c=><ConversationRow key={c.id} chat={c} active={activeId===c.id} onSelect={id=>{setActiveId(id);setMobileOpen(false)}} onRename={renameChat} onDelete={deleteChat} onArchive={archiveChat} onPin={pinChat}/>)}</div>
      {!visible.length&&<div className="empty-list"><MessageSquare size={22}/><span>{archivedOpen?'No archived conversations':'No conversations yet'}</span></div>}
    </div>
    <div className="sidebar-tools"><button className={archivedOpen?'active':''} onClick={()=>{setArchivedOpen(v=>!v);setActiveId(null)}}><Archive size={16}/><span>{archivedOpen?'Back to conversations':'Archived'}</span><ChevronRight size={14}/></button><button onClick={()=>setSettingsOpen(true)}><Settings size={16}/><span>Settings</span><ChevronRight size={14}/></button></div>
    <div className="profile-wrap"><button className="profile-button" onClick={()=>setAccountOpen(v=>!v)}><div className="account-avatar small">{session.email.slice(0,1).toUpperCase()}</div><div><strong>{session.email}</strong><span>{isAdmin?'Administrator':'Authenticated user'}</span></div><ChevronDown size={15}/></button>{accountOpen&&<div className="profile-menu">{isAdmin&&<button onClick={()=>nav('/admin')}><Shield size={15}/>Administration</button>}<button onClick={logout} className="danger-text"><LogOut size={15}/>Sign out</button></div>}</div>
  </>

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen?'':'collapsed'}`}>{sidebarContent}</aside>
    {mobileOpen&&<><div className="mobile-backdrop" onClick={()=>setMobileOpen(false)}/><aside className="sidebar mobile">{sidebarContent}</aside></>}
    <main className="chat-main">
      <header className="chat-topbar"><div className="topbar-left">{!sidebarOpen&&<button className="icon-btn desktop-only" onClick={()=>setSidebarOpen(true)}><PanelLeftOpen size={18}/></button>}<button className="icon-btn mobile-only" onClick={()=>setMobileOpen(true)}><Menu size={19}/></button><div><strong>CloudFin AI</strong><span>Grounded policy assistant</span></div></div><div className="topbar-actions"><div className={`service-pill ${backendStatus}`}><span className="status-dot"/>{backendStatus==='ready'?'Ready':backendStatus==='waking'?'Backend waking':'Checking'}</div>{isAdmin&&<button className="admin-shortcut" onClick={()=>nav('/admin')}><Shield size={15}/>Admin</button>}</div></header>
      <section className="chat-scroll" ref={chatRef}>
        {!active||active.messages.length===0?<div className="welcome-state"><div className="welcome-mark"><BrandMark/></div><p className="section-kicker">ENTERPRISE FINANCIAL RAG</p><h1>What can I help you find?</h1><p>Ask questions across KYC, AML, risk, compliance and uploaded financial policies. CloudFin retrieves evidence first, then generates a grounded answer.</p><div className="quick-grid">{quickQuestions.map(([tag,q])=><button key={q} onClick={()=>send(q)}><span>{tag}</span><strong>{q}</strong><ArrowUp size={15}/></button>)}</div></div>:
        <div className="message-list">{active.messages.map((m,i)=><article className={`message-row ${m.role}`} key={i}><div className="message-avatar">{m.role==='assistant'?<BrandMark compact/>:<User size={15}/>}</div><div className="message-content">{m.role==='assistant'?<ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>:<p>{m.content}</p>}<SourceList sources={m.sources}/>{m.role==='assistant'&&(m.cached||m.provider)&&<div className="message-meta">{m.cached&&<span>Cached</span>}{m.provider&&<span>{m.provider}{m.fallback_used?' fallback':''}</span>}</div>}</div></article>)}{busy&&<article className="message-row assistant"><div className="message-avatar"><BrandMark compact/></div><div className="message-content loading-response"><span/><span/><span/><em>Retrieving policy context…</em></div></article>}</div>}
      </section>
      {error&&<div className="inline-error"><X size={14}/><span>{error}</span><button onClick={()=>setError('')}>Dismiss</button></div>}
      <footer className="composer-area"><div className="composer"><textarea rows={1} value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Ask CloudFin about your financial policies…"/><button className={`voice-btn ${listening?'active':''}`} onClick={toggleVoice} title="Voice input"><Mic size={18}/></button><button className="send-btn" onClick={()=>send()} disabled={busy||!message.trim()}><ArrowUp size={19}/></button></div><div className="composer-note"><span>Shift + Enter for a new line</span><span>CloudFin provides policy information, not financial advice.</span></div></footer>
    </main>
    <SettingsPanel open={settingsOpen} onClose={()=>setSettingsOpen(false)} session={session} appearance={appearance} setAppearance={setAppearance} backend={backendStatus}/>
    <ActionDialog open={Boolean(dialog)} title={dialog?.type==='rename'?'Rename conversation':'Delete conversation?'} description={dialog?.type==='rename'?'Choose a short title so you can find this chat later.':'This conversation is stored only in this browser and will be permanently removed.'} confirmLabel={dialog?.type==='rename'?'Save name':'Delete'} destructive={dialog?.type==='delete'} inputValue={dialog?.type==='rename'?renameValue:undefined} onInputChange={setRenameValue} onConfirm={confirmDialog} onClose={closeDialog}/>
  </div>
}

function Admin() {
  const nav=useNavigate(); const {loading,session}=useAuth(); const [appearance]=useAppearance()
  const [overview,setOverview]=useState(null); const [tab,setTab]=useState('overview'); const [file,setFile]=useState(null); const [query,setQuery]=useState('customer address verification'); const [retrieval,setRetrieval]=useState([]); const [busy,setBusy]=useState(false); const [msg,setMsg]=useState(''); const [admin,setAdmin]=useState(null); const [deleteDoc,setDeleteDoc]=useState(null)
  useEffect(()=>{if(loading)return;if(!session?.token){setAdmin(false);return}let cancel=false;setAdmin(null);api.me(session.token).then(p=>{if(!cancel)setAdmin(Boolean(p.is_admin))}).catch(e=>{if(!cancel){setAdmin(false);setMsg(e.message||'Unable to verify administrator access.')}});return()=>{cancel=true}},[loading,session?.token])
  async function refresh(){if(!session||admin!==true)return;try{setOverview(await api.adminOverview(session.token))}catch(e){setMsg(e.message)}}
  useEffect(()=>{refresh()},[session?.token,admin])
  if(loading)return <div className="full-loader"><BrandMark/><span>Loading…</span></div>
  if(!session)return <Navigate to="/signin" replace/>
  if(admin===null)return <div className="full-loader"><BrandMark/><span>Checking administrator access…</span></div>
  if(!admin)return <div className="access-denied"><div><BrandMark/><p className="section-kicker">RESTRICTED</p><h1>Administrator access required</h1><p>{msg||'This account is not configured as a CloudFin administrator.'}</p><button className="btn primary" onClick={()=>nav('/app')}><ArrowLeft size={15}/>Back to chat</button></div></div>

  async function reload(){setBusy(true);setMsg('');try{await api.adminReload(session.token);await refresh();setMsg('Knowledge index rebuilt successfully.')}catch(e){setMsg(e.message)}finally{setBusy(false)}}
  async function upload(){if(!file)return;setBusy(true);setMsg('');try{await api.adminUpload(session.token,file);setFile(null);const n=document.getElementById('policy-upload');if(n)n.value='';await refresh();setMsg('Document uploaded and indexed.')}catch(e){setMsg(e.message)}finally{setBusy(false)}}
  async function remove(){if(!deleteDoc)return;setBusy(true);try{await api.adminDelete(session.token,deleteDoc.id);await refresh();setMsg('Runtime document removed.');setDeleteDoc(null)}catch(e){setMsg(e.message)}finally{setBusy(false)}}
  async function retrieve(e){e.preventDefault();setBusy(true);setMsg('');try{const r=await api.adminRetrieve(session.token,query,5);setRetrieval(r.results)}catch(e2){setMsg(e2.message)}finally{setBusy(false)}}
  const docs=overview?.documents||[]

  return <div className="admin-shell" data-appearance={appearance}>
    <aside className="admin-sidebar"><div className="sidebar-brand admin-brand"><BrandMark compact/><div><strong>CloudFin</strong><span>Administration</span></div></div><nav><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}><Gauge size={17}/>Overview</button><button className={tab==='knowledge'?'active':''} onClick={()=>setTab('knowledge')}><Database size={17}/>Knowledge base</button><button className={tab==='retrieval'?'active':''} onClick={()=>setTab('retrieval')}><FileSearch size={17}/>Retrieval Lab</button></nav><div className="admin-side-bottom"><button onClick={()=>nav('/app')}><ArrowLeft size={16}/>Back to chat</button><div><div className="account-avatar small">{session.email.slice(0,1).toUpperCase()}</div><span>{session.email}</span></div></div></aside>
    <main className="admin-main"><header className="admin-topbar"><div><span className="section-kicker">CONTROL CENTER</span><h1>{tab==='overview'?'Overview':tab==='knowledge'?'Knowledge Base':'Retrieval Lab'}</h1></div><div className="service-pill ready"><span className="status-dot"/>Admin session active</div></header>
      {msg&&<div className="admin-notice"><Check size={14}/>{msg}<button onClick={()=>setMsg('')}><X size={13}/></button></div>}
      {tab==='overview'&&<><section className="metric-grid">{[['Documents',overview?.knowledge_documents,FileText],['Indexed chunks',overview?.knowledge_chunks,FileSearch],['Core sources',overview?.core_documents,FolderOpen],['Runtime uploads',overview?.runtime_documents,Upload],['Cache entries',overview?.cache_entries,Sparkles]].map(([label,value,Icon])=><div className="metric-card" key={label}><div><span>{label}</span><strong>{value??'—'}</strong></div><Icon size={21}/></div>)}</section><section className="admin-card"><div className="card-head"><div><p className="section-kicker">SYSTEM</p><h2>RAG service status</h2><span>Runtime state of the lightweight hosted architecture.</span></div><button className="btn secondary" onClick={reload} disabled={busy}><RefreshCw size={15} className={busy?'spin':''}/>{busy?'Refreshing':'Rebuild index'}</button></div><div className="system-list"><div><span>Retrieval index</span><b>Ready · v{overview?.index_version??'—'}</b></div><div><span>LLM routing</span><b>Groq primary · Gemini fallback</b></div><div><span>Hosting target</span><b>Vercel + Render</b></div><div><span>Storage</span><b>Core + runtime</b></div></div>{overview?.storage_note&&<p className="storage-note">{overview.storage_note}</p>}</section></>}
      {tab==='knowledge'&&<section className="admin-card knowledge-card"><div className="card-head"><div><p className="section-kicker">DOCUMENTS</p><h2>Policy knowledge base</h2><span>Upload, inspect and remove financial-policy documents used by RAG.</span></div><button className="btn secondary" onClick={reload} disabled={busy}><RefreshCw size={15}/>Re-index all</button></div><div className="upload-zone"><div className="upload-icon"><Upload size={22}/></div><div><strong>{file?file.name:'Upload a policy document'}</strong><span>PDF, DOCX, TXT, MD, XLSX or XLS · up to 8 MB</span></div><label className="btn secondary">Choose file<input id="policy-upload" hidden type="file" accept=".pdf,.docx,.txt,.md,.xlsx,.xls" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><button className="btn primary" onClick={upload} disabled={!file||busy}>{busy?'Indexing…':'Upload & index'}</button></div><div className="document-table"><div className="table-head"><span>Document</span><span>Type</span><span>Chunks</span><span>Source</span><span></span></div>{docs.map(d=><div className="table-row" key={d.id}><div className="doc-name"><FileText size={16}/><div><strong>{d.display_name}</strong><span>{d.name}</span></div></div><span>{String(d.type||'file').toUpperCase()}</span><span>{d.chunks}</span><span><b className={`origin-badge ${d.origin}`}>{d.origin}</b></span><span>{d.origin==='runtime'&&<button className="icon-btn danger-icon" onClick={()=>setDeleteDoc(d)}><Trash2 size={15}/></button>}</span></div>)}</div></section>}
      {tab==='retrieval'&&<section className="admin-card retrieval-lab"><div className="card-head"><div><p className="section-kicker">DEBUG & ANALYSIS</p><h2>Retrieval Lab</h2><span>Inspect what CloudFin retrieves before the LLM receives context.</span></div></div><form className="retrieval-search" onSubmit={retrieve}><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Enter a retrieval query"/><button className="btn primary" disabled={busy||!query.trim()}>Run retrieval</button></form><div className="retrieval-list">{retrieval.map((r,i)=><article key={`${r.document}-${i}`}><div className="rank">{i+1}</div><div><strong>{r.document}</strong><span>{r.section||'General section'}{r.page?` · Page ${r.page}`:''} · {r.origin}</span><p>{r.excerpt}</p></div><div className="score">{Math.round((r.relevance||0)*100)}%</div></article>)}{!retrieval.length&&<div className="retrieval-empty"><FileSearch size={28}/><span>Run a query to inspect retrieved chunks.</span></div>}</div></section>}
    </main>
    <ActionDialog open={Boolean(deleteDoc)} title="Remove uploaded document?" description={deleteDoc?`${deleteDoc.display_name} will be removed from the runtime knowledge base and the index will be rebuilt.`:''} confirmLabel={busy?'Removing…':'Remove document'} destructive onConfirm={remove} onClose={()=>!busy&&setDeleteDoc(null)}/>
  </div>
}

export default function App(){return <Routes><Route path="/signin" element={<AuthCard mode="signin"/>}/><Route path="/signup" element={<AuthCard mode="signup"/>}/><Route path="/forgot-password" element={<ForgotPasswordCard/>}/><Route path="/reset-password" element={<ResetPasswordCard/>}/><Route path="/app" element={<ChatApp/>}/><Route path="/admin" element={<Admin/>}/><Route path="*" element={<Navigate to="/app" replace/>}/></Routes>}
