'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient, type Profile } from '@/lib/supabase'

const NAV = [
  { href: '/', label: 'Dashboard', icon: 'grid' },
  { href: '/pipelines', label: 'Pipelines', icon: 'kanban' },
  { href: '/buyers', label: 'Buyers', icon: 'users' },
  { href: '/title-companies', label: 'Title Companies', icon: 'building' },
  { href: '/activity', label: 'Activity', icon: 'activity' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
]

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    kanban: 'M3 6h4v14H3zM10 3h4v17h-4zM17 9h4v11h-4z',
    users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    building: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
    activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={icons[name] || ''}/>
    </svg>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [dealCount, setDealCount] = useState(0)
  const [buyerCount, setBuyerCount] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
    // Load counts
    supabase.from('deals').select('id', { count: 'exact', head: true }).then(({ count }) => setDealCount(count || 0))
    supabase.from('buyers').select('id', { count: 'exact', head: true }).then(({ count }) => setBuyerCount(count || 0))

    // Realtime count updates
    const ch = supabase.channel('counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
        supabase.from('deals').select('id', { count: 'exact', head: true }).then(({ count }) => setDealCount(count || 0))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buyers' }, () => {
        supabase.from('buyers').select('id', { count: 'exact', head: true }).then(({ count }) => setBuyerCount(count || 0))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = profile?.full_name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '?'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: '200px', minWidth: '200px',
        background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Logo */}
        <div style={{ padding: '16px 14px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            DispoCRM <span style={{ color: 'var(--accent)' }}>Pro</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            wholesale re
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: '9px',
                padding: '7px 9px', borderRadius: '8px', textDecoration: 'none',
                color: active ? 'var(--accent)' : 'var(--text2)',
                background: active ? 'var(--accent-dim)' : 'transparent',
                border: active ? '1px solid var(--accent-border)' : '1px solid transparent',
                fontSize: '12px', fontWeight: 500, transition: 'all 0.12s',
              }}>
                <Icon name={item.icon} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.href === '/pipelines' && dealCount > 0 && (
                  <span style={{ fontSize: '10px', background: 'var(--bg5)', color: 'var(--text3)', borderRadius: '99px', padding: '1px 6px', fontFamily: 'var(--font-mono)' }}>
                    {dealCount}
                  </span>
                )}
                {item.href === '/buyers' && buyerCount > 0 && (
                  <span style={{ fontSize: '10px', background: 'var(--bg5)', color: 'var(--text3)', borderRadius: '99px', padding: '1px 6px', fontFamily: 'var(--font-mono)' }}>
                    {buyerCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px', borderRadius: '8px', background: 'var(--bg3)' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)',
              flexShrink: 0
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.full_name || profile?.email || '...'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                {profile?.role || 'agent'}
              </div>
            </div>
            <button onClick={signOut} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text3)', padding: '2px', flexShrink: 0
            }} title="Sign out">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </main>
    </div>
  )
}
