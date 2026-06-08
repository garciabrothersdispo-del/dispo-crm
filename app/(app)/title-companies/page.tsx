'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient, type TitleCompany } from '@/lib/supabase'

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
  'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
  'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
  'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico',
  'New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania',
  'Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming'
]

const DEAL_TYPES = ['Wholesale', 'Novations', 'Creative', 'Other']

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

export default function TitleCompaniesPage() {
  const supabase = createClient()
  const [companies, setCompanies] = useState<TitleCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [activeCard, setActiveCard] = useState<TitleCompany | null>(null)
  const [userId, setUserId] = useState('')
  const [toast, setToast] = useState('')

  const emptyForm = {
    name: '', state: 'Texas', counties: '', deals_done: '0',
    deal_types: [] as string[], escrow_officer: '', email: '',
    phone: '', hours: '', days: '', notes: ''
  }
  const [form, setForm] = useState(emptyForm)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const loadCompanies = useCallback(async () => {
    const { data } = await supabase.from('title_companies').select('*').order('state').order('name')
    setCompanies(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id) })
    loadCompanies()
    const ch = supabase.channel('title-companies-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'title_companies' }, loadCompanies)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadCompanies])

  const allStates = [...new Set(companies.map(c => c.state))].sort()

  const filtered = companies.filter(c => {
    const hay = [c.name, c.state, c.counties_covered, c.escrow_officer].join(' ').toLowerCase()
    if (search && !hay.includes(search.toLowerCase())) return false
    if (stateFilter.length && !stateFilter.includes(c.state)) return false
    if (typeFilter.length && !typeFilter.some(t => c.deal_types?.includes(t))) return false
    return true
  })

  function toggleFilter(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  function toggleDealType(type: string) {
    setForm(p => ({
      ...p,
      deal_types: p.deal_types.includes(type)
        ? p.deal_types.filter(t => t !== type)
        : [...p.deal_types, type]
    }))
  }

  async function saveCompany() {
    if (!form.name.trim()) { showToast('Company name required'); return }
    const payload = {
      name: form.name.trim(),
      state: form.state,
      counties_covered: form.counties.trim() || null,
      deals_done: parseInt(form.deals_done) || 0,
      deal_types: form.deal_types,
      escrow_officer: form.escrow_officer.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      hours_of_operation: form.hours.trim() || null,
      days_of_operation: form.days.trim() || null,
      notes: form.notes.trim() || null,
    }
    if (editId) {
      await supabase.from('title_companies').update(payload).eq('id', editId)
      showToast('Company updated ✓')
      if (activeCard?.id === editId) setActiveCard(prev => prev ? { ...prev, ...payload } : null)
    } else {
      await supabase.from('title_companies').insert({ ...payload, created_by: userId })
      showToast('Company added ✓')
    }
    setShowModal(false)
    setForm(emptyForm)
    setEditId(null)
  }

  function openEdit(c: TitleCompany) {
    setForm({
      name: c.name, state: c.state, counties: c.counties_covered || '',
      deals_done: String(c.deals_done || 0), deal_types: c.deal_types || [],
      escrow_officer: c.escrow_officer || '', email: c.email || '',
      phone: c.phone || '', hours: c.hours_of_operation || '',
      days: c.days_of_operation || '', notes: c.notes || ''
    })
    setEditId(c.id)
    setShowModal(true)
  }

  async function deleteCompany(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Cannot be undone.`)) return
    await supabase.from('title_companies').delete().eq('id', id)
    if (activeCard?.id === id) setActiveCard(null)
    showToast('Company deleted')
  }

  // Group filtered companies by state
  const byState: Record<string, TitleCompany[]> = {}
  filtered.forEach(c => {
    if (!byState[c.state]) byState[c.state] = []
    byState[c.state].push(c)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>Title Companies</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{companies.length} companies · organized by state</div>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true) }} style={{ padding: '7px 14px', borderRadius: '8px', background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
          + Add Company
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Filter Sidebar */}
        <div style={{ width: '200px', minWidth: '200px', background: 'var(--bg2)', borderRight: '1px solid var(--border)', padding: '14px 10px', overflowY: 'auto', flexShrink: 0 }}>
          {/* States */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', padding: '0 4px 6px' }}>State</div>
            {allStates.map(s => {
              const count = companies.filter(c => c.state === s).length
              const active = stateFilter.includes(s)
              return (
                <div key={s} onClick={() => toggleFilter(stateFilter, setStateFilter, s)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', background: active ? 'var(--accent-dim)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text2)', fontSize: '11px', transition: 'all 0.12s', marginBottom: '2px' }}>
                  <span>{s}</span>
                  <span style={{ fontSize: '10px', color: active ? 'var(--accent)' : 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{count}</span>
                </div>
              )
            })}
          </div>

          {/* Deal Types */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', padding: '0 4px 6px' }}>Deal Type</div>
            {DEAL_TYPES.map(t => {
              const count = companies.filter(c => c.deal_types?.includes(t)).length
              if (!count) return null
              const active = typeFilter.includes(t)
              return (
                <div key={t} onClick={() => toggleFilter(typeFilter, setTypeFilter, t)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', background: active ? 'var(--accent-dim)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text2)', fontSize: '11px', transition: 'all 0.12s', marginBottom: '2px' }}>
                  <span>{t}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{count}</span>
                </div>
              )
            })}
          </div>

          {(stateFilter.length > 0 || typeFilter.length > 0) && (
            <button onClick={() => { setStateFilter([]); setTypeFilter([]) }} style={{ width: '100%', padding: '6px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: '11px' }}>
              Clear filters
            </button>
          )}
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Search */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input className="input-base" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, state, county, officer..." style={{ maxWidth: '340px' }} />
            <span style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{filtered.length} shown</span>
          </div>

          {/* Companies by State */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {loading ? (
              <div style={{ color: 'var(--text3)', fontSize: '12px' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>🏢</div>
                <div style={{ fontSize: '14px', color: 'var(--text2)', fontWeight: 600, marginBottom: '5px' }}>No title companies yet</div>
                <div style={{ fontSize: '12px' }}>Add your first title company to get started.</div>
              </div>
            ) : Object.entries(byState).map(([state, stateCompanies]) => (
              <div key={state} style={{ marginBottom: '28px' }}>
                {/* State header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{state}</div>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{stateCompanies.length} {stateCompanies.length === 1 ? 'company' : 'companies'}</div>
                </div>

                {/* Cards grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {stateCompanies.map(c => (
                    <div key={c.id} onClick={() => setActiveCard(c)}
                      style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '13px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.12s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}>
                      <div style={{ height: '3px', background: 'var(--accent)', opacity: 0.5 }} />
                      <div style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700 }}>{c.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{c.state}{c.counties_covered ? ` · ${c.counties_covered}` : ''}</div>
                          </div>
                          {c.deals_done > 0 && (
                            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)', fontFamily: 'var(--font-mono)', fontWeight: 700, flexShrink: 0 }}>
                              {c.deals_done} deals
                            </span>
                          )}
                        </div>

                        {/* Deal types */}
                        {c.deal_types?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                            {c.deal_types.map(t => (
                              <span key={t} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '99px', background: 'var(--bg4)', color: 'var(--text3)', border: '1px solid var(--border)' }}>{t}</span>
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border)', paddingTop: '10px', fontSize: '11px' }}>
                          {c.escrow_officer && <div style={{ display: 'flex', gap: '6px' }}><span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', minWidth: '52px', paddingTop: '1px' }}>Officer</span><span style={{ color: 'var(--text2)' }}>{c.escrow_officer}</span></div>}
                          {c.phone && <div style={{ display: 'flex', gap: '6px' }}><span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', minWidth: '52px', paddingTop: '1px' }}>Phone</span><span style={{ color: 'var(--text2)' }}>{c.phone}</span></div>}
                          {c.email && <div style={{ display: 'flex', gap: '6px' }}><span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', minWidth: '52px', paddingTop: '1px' }}>Email</span><span style={{ color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</span></div>}
                          {(c.days_of_operation || c.hours_of_operation) && (
                            <div style={{ display: 'flex', gap: '6px' }}><span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', minWidth: '52px', paddingTop: '1px' }}>Hours</span><span style={{ color: 'var(--text2)' }}>{[c.days_of_operation, c.hours_of_operation].filter(Boolean).join(' · ')}</span></div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                          <button onClick={e => { e.stopPropagation(); openEdit(c) }} style={{ padding: '4px 10px', borderRadius: '7px', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: '11px' }}>Edit</button>
                          {c.phone && <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()} style={{ padding: '4px 10px', borderRadius: '7px', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: '11px', textDecoration: 'none' }}>Call</a>}
                          {c.email && <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} style={{ padding: '4px 10px', borderRadius: '7px', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: '11px', textDecoration: 'none' }}>Email</a>}
                          <button onClick={e => { e.stopPropagation(); deleteCompany(c.id, c.name) }} style={{ marginLeft: 'auto', padding: '4px 8px', borderRadius: '7px', border: '1px solid rgba(240,90,90,0.25)', background: 'var(--red-dim)', color: 'var(--red)', cursor: 'pointer', fontSize: '11px' }}>×</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DETAIL PANEL */}
      {activeCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', backdropFilter: 'blur(3px)' }} onClick={e => { if (e.target === e.currentTarget) setActiveCard(null) }}>
          <div className="animate-slide-in" style={{ width: '480px', maxWidth: '96vw', background: 'var(--bg2)', borderLeft: '1px solid var(--border2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: '12px', flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '3px' }}>{activeCard.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{activeCard.state}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => openEdit(activeCard)} className="btn-base" style={{ fontSize: '11px', padding: '5px 10px' }}>Edit</button>
                <button onClick={() => setActiveCard(null)} className="btn-base" style={{ fontSize: '11px', padding: '5px 10px', background: 'transparent', border: 'none', color: 'var(--text3)' }}>✕</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {[
                { label: 'State', value: activeCard.state },
                { label: 'Counties Covered', value: activeCard.counties_covered },
                { label: 'Deals Done With Us', value: activeCard.deals_done ? String(activeCard.deals_done) : null },
                { label: 'Escrow Officer', value: activeCard.escrow_officer },
                { label: 'Email', value: activeCard.email },
                { label: 'Phone', value: activeCard.phone },
                { label: 'Hours of Operation', value: activeCard.hours_of_operation },
                { label: 'Days of Operation', value: activeCard.days_of_operation },
              ].map(row => row.value ? (
                <div key={row.label} style={{ display: 'flex', gap: '12px', marginBottom: '14px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', minWidth: '130px', paddingTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.label}</span>
                  <span style={{ color: 'var(--text2)', flex: 1 }}>{row.value}</span>
                </div>
              ) : null)}

              {activeCard.deal_types?.length > 0 && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                  <span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', minWidth: '130px', paddingTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deal Types</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {activeCard.deal_types.map(t => (
                      <span key={t} style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '99px', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {activeCard.notes && (
                <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg3)', borderRadius: '9px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>Notes</div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.6 }}>{activeCard.notes}</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                {activeCard.phone && <a href={`tel:${activeCard.phone}`} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: '12px', textDecoration: 'none' }}>📞 Call</a>}
                {activeCard.email && <a href={`mailto:${activeCard.email}`} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontSize: '12px', textDecoration: 'none' }}>✉️ Email</a>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditId(null) } }}>
          <div className="animate-modal-in" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '14px', padding: '22px 24px', width: '560px', maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700 }}>{editId ? 'Edit Title Company' : 'Add Title Company'}</div>
              <button onClick={() => { setShowModal(false); setEditId(null) }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>

            {/* Company Name */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Company Name *</label>
              <input className="input-base" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Premier Title & Escrow" autoFocus />
            </div>

            {/* State + Deals Done */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>State Covered</label>
                <select className="input-base" value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} style={{ cursor: 'pointer' }}>
                  {US_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Deals Done With Us</label>
                <input className="input-base" type="number" min="0" value={form.deals_done} onChange={e => setForm(p => ({ ...p, deals_done: e.target.value }))} placeholder="0" />
              </div>
            </div>

            {/* Counties */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Counties Covered (comma separated)</label>
              <input className="input-base" value={form.counties} onChange={e => setForm(p => ({ ...p, counties: e.target.value }))} placeholder="Dallas County, Tarrant County, Collin County" />
            </div>

            {/* Deal Types */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '8px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Types of Deals They Can Handle (select all that apply)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {DEAL_TYPES.map(t => {
                  const selected = form.deal_types.includes(t)
                  return (
                    <div key={t} onClick={() => toggleDealType(t)} style={{ padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, transition: 'all 0.12s', background: selected ? 'var(--accent-dim)' : 'var(--bg3)', color: selected ? 'var(--accent)' : 'var(--text2)', border: `1px solid ${selected ? 'var(--accent-border)' : 'var(--border)'}` }}>
                      {selected ? '✓ ' : ''}{t}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Escrow Officer + Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Escrow Officer</label>
                <input className="input-base" value={form.escrow_officer} onChange={e => setForm(p => ({ ...p, escrow_officer: e.target.value }))} placeholder="Jane Smith" />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Phone #</label>
                <input className="input-base" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 000-0000" />
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Email</label>
              <input className="input-base" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="officer@titlecompany.com" />
            </div>

            {/* Days + Hours */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Days of Operation</label>
                <input className="input-base" value={form.days} onChange={e => setForm(p => ({ ...p, days: e.target.value }))} placeholder="Mon–Fri" />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Hours of Operation</label>
                <input className="input-base" value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} placeholder="8:00 AM – 5:00 PM" />
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Additional Notes</label>
              <textarea className="input-base" rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any extra details..." style={{ resize: 'none' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => { setShowModal(false); setEditId(null) }} className="btn-base">Cancel</button>
              <button onClick={saveCompany} style={{ padding: '7px 16px', borderRadius: '8px', background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                {editId ? 'Save Changes' : 'Add Company'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', padding: '9px 16px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--accent-border)', color: 'var(--accent)', fontSize: '12px', fontWeight: 500, zIndex: 999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
