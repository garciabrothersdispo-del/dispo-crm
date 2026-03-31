'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return; }
      router.push('/')
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } }
      })
      if (error) { setError(error.message); setLoading(false); return; }
      setMessage('Check your email to confirm your account.')
    }
    setLoading(false)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '20px'
    }}>
      <div style={{
        width: '100%', maxWidth: '400px',
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: '16px', padding: '32px', boxShadow: '0 8px 40px rgba(0,0,0,0.5)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '4px' }}>
            DispoCRM <span style={{ color: 'var(--accent)' }}>Pro</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
            wholesale real estate
          </div>
        </div>

        {/* Tab Toggle */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          background: 'var(--bg3)', borderRadius: '8px', padding: '3px', marginBottom: '22px'
        }}>
          {(['login', 'signup'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '7px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: mode === m ? 'var(--bg4)' : 'transparent',
              color: mode === m ? 'var(--text)' : 'var(--text3)',
              fontWeight: mode === m ? 600 : 400, fontSize: '12px',
              transition: 'all 0.15s'
            }}>
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* Google */}
        <button onClick={handleGoogle} style={{
          width: '100%', padding: '10px', borderRadius: '8px',
          border: '1px solid var(--border2)', background: 'var(--bg3)',
          color: 'var(--text)', cursor: 'pointer', fontSize: '13px',
          fontWeight: 500, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '10px', marginBottom: '16px',
          transition: 'all 0.12s'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px'
        }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}/>
          <span style={{ fontSize: '11px', color: 'var(--text3)' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}/>
        </div>

        {/* Form */}
        <form onSubmit={handleEmailAuth}>
          {mode === 'signup' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Full Name</label>
              <input
                className="input-base"
                value={name} onChange={e => setName(e.target.value)}
                placeholder="John Smith" required
              />
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
            <input
              className="input-base"
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@email.com" required
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Password</label>
            <input
              className="input-base"
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required minLength={6}
            />
          </div>

          {error && (
            <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--red-dim)', border: '1px solid rgba(240,90,90,0.25)', color: 'var(--red)', fontSize: '12px', marginBottom: '14px' }}>
              {error}
            </div>
          )}

          {message && (
            <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)', fontSize: '12px', marginBottom: '14px' }}>
              {message}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '10px', borderRadius: '8px',
            background: loading ? 'var(--bg4)' : 'var(--accent)',
            color: loading ? 'var(--text3)' : '#000',
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '13px', fontWeight: 700, transition: 'all 0.15s'
          }}>
            {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
