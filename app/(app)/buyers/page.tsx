'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient, logActivity, type Buyer } from '@/lib/supabase'

const BUYER_TYPES = ['Fix & Flip', 'Buy & Hold', 'Developer', 'Investment Realtor', 'Wholetailer', 'New Construction', 'Land']
const RANKS = ['VIP', 'Qualified', 'Unqualified'] as const
const RANK_COLORS = { VIP: 'var(--amber)', Qualified: 'var(--blue)', Unqualified: 'var(--text3)' }
const RANK_DIMS = { VIP: 'var(--amber-dim)', Qualified: 'var(--blue-dim)', Unqualified: 'var(--bg4)' }

export default function BuyersPage() {
  const supabase = createClient()
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [rankFilter, setRankFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [cityFilter, setCityFilter] = useState<string[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [toast, setToast] = useState('')

  const emptyForm = { fname: '', lname: '', phone: '', email: '', company: '', rank: 'Unqualified' as Buyer['rank'], type: 'Fix & Flip', range: '', city: '', zips: '', close: '', pof: 'Not Verified', tags: '', notes: '' }
  const [form, setForm] = useState(emptyForm)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const loadBuyers = useCallback(async () => {
    const { data } = await supabase.from('buyers').select('*').order('created_at', { ascending: false })
    setBuyers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id) })
    loadBuyers()
    const ch = supabase.channel('buyers-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buyers' }, loadBuyers)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadBuyers])

  const allCities = [...new Set(buyers.map(b => b.city).filter(Boolean))] as string[]

  const filtered = buyers.filter(b => {
    const hay = [b.first_name, b.last_name, b.company, b.city, b.zip_codes, ...(b.tags || [])].join(' ').toLowerCase()
    if (search && !hay.includes(search.toLowerCase())) return false
    if (rankFilter.length && !rankFilter.includes(b.rank)) return false
    if (typeFilter.length && !typeFilter.includes(b.buyer_type || '')) return false
    if (cityFilter.length && !cityFilter.includes(b.city || '')) return false
    return true
  })

  function toggleFilter(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  async function saveBuyer() {
    if (!form.fname.trim()) { showToast('First name required'); return }
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    const payload = {
      first_name: form.fname, last_name: form.lname, phone: form.phone, email: form.email,
      company: form.company, rank: form.rank, buyer_type: form.type, price_range: form.range,
      city: form.city, zip_codes: form.zips, close_timeline: form.close, proof_of_funds: form.pof,
      tags, notes: form.notes,
    }
    if (editId) {
      await supabase.from('buyers').update(payload).eq('id', editId)
      await logActivity(supabase, userId, 'updated buyer', 'buyer', editId, `${form.fname} ${form.lname}`)
      showToast('Buyer updated ✓')
    } else {
      const { data } = await supabase.from('buyers').insert({ ...payload, created_by: userId }).select().single()
      if (data) await logActivity(supabase, userId, 'added buyer', 'buyer', data.id, `${form.fname} ${form.lname}`)
      showToast('Buyer added ✓')
    }
    setShowModal(false)
    setForm(emptyForm)
    setEditId(null)
  }

  function openEdit(b: Buyer) {
    setForm({ fname: b.first_name, lname: b.last_name || '', phone: b.phone || '', email: b.email || '', company: b.company || '', rank: b.rank, type: b.buyer_type || 'Fix & Flip', range: b.price_range || '', city: b.city || '', zips: b.zip_codes || '', close: b.close_timeline || '', pof: b.proof_of_funds || 'Not Verified', tags: (b.tags || []).join(', '), notes: b.notes || '' })
    setEditId(b.id)
    setShowModal(true)
  }

  async function deleteBuyer(id: string, name: string) {
    if (!confirm(`Delete ${name}? Cannot be undone.`)) return
    await supabase.from('buyers').delete().eq('id', id)
    await logActivity(supabase, userId, 'deleted buyer', 'buyer', id, name)
    showToast('Buyer deleted')
  }

  function exportCSV() {
    const rows = [['First Name', 'Last Name', 'Phone', 'Email', 'City', 'Zip Codes']]
    filtered.forEach(b => rows.push([b.first_name || '', b.last_name || '', b.phone || '', b.email || '', b.city || '', b.zip_codes || '']))
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `buyers-ghl-${new Date().toISOString().split('T')[0]}.csv`; a.click()
    showToast(`Exported ${filtered.length} buyers ✓`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>Buyer Database</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{buyers.length} buyers total</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={exportCSV} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--blue-border, rgba(79,158,255,0.25))', background: 'var(--blue-dim)', color: 'var(--blue)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
            Export CSV (GHL)
          </button>
          <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true) }} style={{ padding: '7px 14px', borderRadius: '8px', background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
            + Add Buyer
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Filter Sidebar */}
        <div style={{ width: '200px', minWidth: '200px', background: 'var(--bg2)', borderRight: '1px solid var(--border)', padding: '14px 10px', overflowY: 'auto' }}>
          {/* Rank */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', padding: '0 4px 6px' }}>Rank</div>
            {RANKS.map(r => {
              const count = buyers.filter(b => b.rank === r).length
              const active = rankFilter.includes(r)
              return (
                <div key={r} onClick={() => toggleFilter(rankFilter, setRankFilter, r)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '7px', cursor: 'pointer', background: active ? `${RANK_DIMS[r]}` : 'transparent', color: active ? RANK_COLORS[r] : 'var(--text2)', fontSize: '12px', fontWeight: active ? 600 : 400, transition: 'all 0.12s', marginBottom: '2px' }}>
                  <span>{r}</span>
                  <span style={{ fontSize: '10px', color: active ? RANK_COLORS[r] : 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{count}</span>
                </div>
              )
            })}
          </div>

          {/* Type */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', padding: '0 4px 6px' }}>Type</div>
            {BUYER_TYPES.map(t => {
              const count = buyers.filter(b => b.buyer_type === t).length
              if (!count) return null
              const active = typeFilter.includes(t)
              return (
                <div key={t} onClick={() => toggleFilter(typeFilter, setTypeFilter, t)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', background: active ? 'var(--accent-dim)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text2)', fontSize: '11px', transition: 'all 0.12s', marginBottom: '2px' }}>
                  <span>{t}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{count}</span>
                </div>
              )
            })}
          </div>

          {/* City */}
          {allCities.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', padding: '0 4px 6px' }}>City</div>
              {allCities.map(c => {
                const count = buyers.filter(b => b.city === c).length
                const active = cityFilter.includes(c)
                return (
                  <div key={c} onClick={() => toggleFilter(cityFilter, setCityFilter, c)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderRadius: '7px', cursor: 'pointer', background: active ? 'var(--accent-dim)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text2)', fontSize: '11px', transition: 'all 0.12s', marginBottom: '2px' }}>
                    <span>{c}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{count}</span>
                  </div>
                )
              })}
            </div>
          )}

          {(rankFilter.length || typeFilter.length || cityFilter.length) > 0 && (
            <button onClick={() => { setRankFilter([]); setTypeFilter([]); setCityFilter([]) }} style={{ marginTop: '12px', width: '100%', padding: '6px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: '11px' }}>
              Clear filters
            </button>
          )}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Search */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input className="input-base" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, city, zip, tag..." style={{ maxWidth: '320px' }} />
            <span style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{filtered.length} shown</span>
          </div>

          {/* Grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '12px', alignContent: 'start' }}>
            {loading ? (
              <div style={{ color: 'var(--text3)', fontSize: '12px' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>👥</div>
                <div style={{ fontSize: '14px', color: 'var(--text2)', fontWeight: 600, marginBottom: '5px' }}>No buyers found</div>
                <div style={{ fontSize: '12px' }}>Add buyers or adjust your filters.</div>
              </div>
            ) : filtered.map(b => {
              const initials = ((b.first_name || '?')[0] + (b.last_name || '')[0]).toUpperCase()
              const rankColor = RANK_COLORS[b.rank]
              const rankDim = RANK_DIMS[b.rank]
              return (
                <div key={b.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '13px', overflow: 'hidden', transition: 'border-color 0.12s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}>
                  {/* Rank bar */}
                  <div style={{ height: '3px', background: rankColor, opacity: 0.7 }} />
                  <div style={{ padding: '14px' }}>
                    {/* Name row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: rankDim, border: `1px solid ${rankColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: rankColor, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.first_name} {b.last_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.company || b.buyer_type}</div>
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '99px', background: rankDim, color: rankColor, border: `1px solid ${rankColor}44`, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', flexShrink: 0 }}>
                        {b.rank}
                      </span>
                    </div>

                    {/* Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border)', paddingTop: '10px', fontSize: '11px' }}>
                      {b.phone && <div style={{ display: 'flex', gap: '6px' }}><span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', minWidth: '52px', paddingTop: '1px' }}>Phone</span><span style={{ color: 'var(--text2)' }}>{b.phone}</span></div>}
                      {b.email && <div style={{ display: 'flex', gap: '6px' }}><span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', minWidth: '52px', paddingTop: '1px' }}>Email</span><span style={{ color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.email}</span></div>}
                      {b.price_range && <div style={{ display: 'flex', gap: '6px' }}><span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', minWidth: '52px', paddingTop: '1px' }}>Buy box</span><span style={{ color: 'var(--text2)' }}>{b.price_range}</span></div>}
                      {(b.city || b.zip_codes) && <div style={{ display: 'flex', gap: '6px' }}><span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', minWidth: '52px', paddingTop: '1px' }}>Area</span><span style={{ color: 'var(--text2)' }}>{[b.city, b.zip_codes].filter(Boolean).join(' · ')}</span></div>}
                      {b.close_timeline && <div style={{ display: 'flex', gap: '6px' }}><span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', minWidth: '52px', paddingTop: '1px' }}>Close</span><span style={{ color: 'var(--text2)' }}>{b.close_timeline}</span></div>}
                      {b.proof_of_funds && b.proof_of_funds !== 'Not Verified' && <div style={{ display: 'flex', gap: '6px' }}><span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', minWidth: '52px', paddingTop: '1px' }}>POF</span><span style={{ color: 'var(--accent)' }}>{b.proof_of_funds}</span></div>}
                      {b.notes && <div style={{ display: 'flex', gap: '6px' }}><span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '10px', minWidth: '52px', paddingTop: '1px' }}>Notes</span><span style={{ color: 'var(--text2)', fontStyle: 'italic' }}>{b.notes}</span></div>}
                    </div>

                    {/* Tags */}
                    {b.tags?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                        {b.tags.map(t => (
                          <span key={t} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: 'var(--bg4)', color: 'var(--text3)', border: '1px solid var(--border)' }}>{t}</span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                      <button onClick={() => openEdit(b)} style={{ padding: '4px 10px', borderRadius: '7px', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: '11px', transition: 'all 0.12s' }}>Edit</button>
                      {b.phone && <a href={`tel:${b.phone}`} style={{ padding: '4px 10px', borderRadius: '7px', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Call</a>}
                      {b.email && <a href={`mailto:${b.email}`} style={{ padding: '4px 10px', borderRadius: '7px', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Email</a>}
                      <button onClick={() => deleteBuyer(b.id, `${b.first_name} ${b.last_name}`)} style={{ marginLeft: 'auto', padding: '4px 8px', borderRadius: '7px', border: '1px solid rgba(240,90,90,0.25)', background: 'var(--red-dim)', color: 'var(--red)', cursor: 'pointer', fontSize: '11px' }}>×</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditId(null) } }}>
          <div className="animate-modal-in" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '14px', padding: '22px 24px', width: '540px', maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700 }}>{editId ? 'Edit Buyer' : 'Add Buyer'}</div>
              <button onClick={() => { setShowModal(false); setEditId(null) }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>

            {[
              { label: 'First Name *', key: 'fname', placeholder: 'John', half: true },
              { label: 'Last Name', key: 'lname', placeholder: 'Smith', half: true },
              { label: 'Phone', key: 'phone', placeholder: '(555) 000-0000', half: true },
              { label: 'Email', key: 'email', placeholder: 'john@email.com', half: true },
              { label: 'Company', key: 'company', placeholder: 'Smith REI', half: true },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '12px', gridColumn: f.half ? 'auto' : '1/-1' }}>
                <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{f.label}</label>
                <input className="input-base" value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Rank</label>
                <select className="input-base" value={form.rank} onChange={e => setForm(p => ({ ...p, rank: e.target.value as Buyer['rank'] }))} style={{ cursor: 'pointer' }}>
                  {RANKS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Buyer Type</label>
                <select className="input-base" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={{ cursor: 'pointer' }}>
                  {BUYER_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Price Range</label>
                <input className="input-base" value={form.range} onChange={e => setForm(p => ({ ...p, range: e.target.value }))} placeholder="$50k–$150k" />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>City</label>
                <input className="input-base" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Dallas" />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Zip Codes</label>
              <input className="input-base" value={form.zips} onChange={e => setForm(p => ({ ...p, zips: e.target.value }))} placeholder="75201, 75202, 75205" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Close Timeline</label>
                <input className="input-base" value={form.close} onChange={e => setForm(p => ({ ...p, close: e.target.value }))} placeholder="14–21 days" />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Proof of Funds</label>
                <select className="input-base" value={form.pof} onChange={e => setForm(p => ({ ...p, pof: e.target.value }))} style={{ cursor: 'pointer' }}>
                  <option>Not Verified</option><option>Verified</option><option>Cash Buyer</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tags (comma separated)</label>
              <input className="input-base" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="cash, quick close, SFR" />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Notes</label>
              <textarea className="input-base" rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any notes about this buyer..." style={{ resize: 'none' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => { setShowModal(false); setEditId(null) }} className="btn-base">Cancel</button>
              <button onClick={saveBuyer} style={{ padding: '7px 16px', borderRadius: '8px', background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                {editId ? 'Save Changes' : 'Add Buyer'}
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
