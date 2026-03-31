'use client'
import { useEffect, useState } from 'react'
import { createClient, type Profile } from '@/lib/supabase'

export default function SettingsPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [team, setTeam] = useState<Profile[]>([])
  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
        setProfile(data); setFullName(data?.full_name || '')
      })
      supabase.from('profiles').select('*').order('created_at').then(({ data }) => setTeam(data || []))
    })
  }, [])

  async function saveProfile() {
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile.id)
    setToast('Profile saved ✓'); setSaving(false)
    setTimeout(() => setToast(''), 2500)
  }

  async function updateRole(userId: string, role: 'admin' | 'agent') {
    await supabase.from('profiles').update({ role }).eq('id', userId)
    setTeam(team.map(t => t.id === userId ? { ...t, role } : t))
    setToast('Role updated ✓'); setTimeout(() => setToast(''), 2500)
  }

  async function exportData() {
    const [{ data: deals }, { data: buyers }] = await Promise.all([
      supabase.from('deals').select('*'),
      supabase.from('buyers').select('*'),
    ])
    const blob = new Blob([JSON.stringify({ deals, buyers, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `dispo-crm-backup-${new Date().toISOString().split('T')[0]}.json`; a.click()
    setToast('Exported ✓'); setTimeout(() => setToast(''), 2500)
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <div style={{ fontSize: '14px', fontWeight: 700 }}>Settings</div>
        <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>account & team management</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: '600px' }}>

        {/* Profile */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            Your Profile
          </div>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Full Name</label>
              <input className="input-base" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name"/>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
              <input className="input-base" value={profile?.email || ''} disabled style={{ opacity: 0.5 }}/>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Role</label>
              <input className="input-base" value={profile?.role || ''} disabled style={{ opacity: 0.5 }}/>
            </div>
            <button onClick={saveProfile} disabled={saving} className="btn-base" style={{ width: 'fit-content', background: 'var(--accent)', color: '#000', border: 'none', fontWeight: 700 }}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>

        {/* Team */}
        {isAdmin && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
              Team Members
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {team.map(member => (
                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '9px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg4)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                    {(member.full_name || member.email || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{member.full_name || 'No name'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{member.email}</div>
                  </div>
                  {member.id !== profile?.id ? (
                    <select value={member.role} onChange={e => updateRole(member.id, e.target.value as 'admin' | 'agent')}
                      className="input-base" style={{ width: 'auto', padding: '5px 10px', fontSize: '11px' }}>
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span style={{ fontSize: '10px', padding: '3px 9px', borderRadius: '99px', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)', fontFamily: 'var(--font-mono)' }}>
                      you · {member.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text3)', lineHeight: 1.6 }}>
              To invite a team member, have them sign up at your app URL — they'll automatically get agent access. Promote them to admin here.
            </div>
          </div>
        )}

        {/* Data */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            Data
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={exportData} className="btn-base">Export all data (JSON)</button>
          </div>
        </div>

        {toast && (
          <div style={{ position: 'fixed', bottom: '20px', right: '20px', padding: '9px 16px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--accent-border)', color: 'var(--accent)', fontSize: '12px', fontWeight: 500 }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
