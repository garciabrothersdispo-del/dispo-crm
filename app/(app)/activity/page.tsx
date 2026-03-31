'use client'
import { useEffect, useState } from 'react'
import { createClient, type ActivityLog } from '@/lib/supabase'
import { format } from 'date-fns'

export default function ActivityPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('activity_log')
      .select('*, profiles(full_name, email, role)')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => { setLogs(data || []); setLoading(false) })

    const ch = supabase.channel('activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, () => {
        supabase.from('activity_log').select('*, profiles(full_name, email, role)').order('created_at', { ascending: false }).limit(200)
          .then(({ data }) => setLogs(data || []))
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const actionColor = (action: string) => {
    if (action.includes('created') || action.includes('added')) return 'var(--accent)'
    if (action.includes('deleted') || action.includes('removed')) return 'var(--red)'
    if (action.includes('moved') || action.includes('updated')) return 'var(--blue)'
    if (action.includes('completed')) return 'var(--accent)'
    return 'var(--text2)'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <div style={{ fontSize: '14px', fontWeight: 700 }}>Activity Log</div>
        <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>who did what and when</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: '12px' }}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: '12px' }}>No activity yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '800px' }}>
            {logs.map(log => {
              const name = log.profiles?.full_name || log.profiles?.email || 'Unknown'
              const initials = name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
              return (
                <div key={log.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '10px 12px', borderRadius: '9px',
                  transition: 'background 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                    background: 'var(--bg4)', border: '1px solid var(--border2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700, color: 'var(--text3)', fontFamily: 'var(--font-mono)'
                  }}>{initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{name}</span>
                      {' '}
                      <span style={{ color: actionColor(log.action) }}>{log.action}</span>
                      {log.entity_label && (
                        <span style={{ color: 'var(--text2)' }}> — <span style={{ fontWeight: 500 }}>{log.entity_label}</span></span>
                      )}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      {format(new Date(log.created_at), 'MMM d, yyyy · h:mm a')}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
