'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient, parseMoney, type Deal, PIPELINES } from '@/lib/supabase'
import { format, subDays, startOfYear } from 'date-fns'

type DateRange = '7d' | '30d' | '90d' | 'ytd' | 'all' | 'custom'

const RANGES: { label: string; value: DateRange }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: 'YTD', value: 'ytd' },
  { label: 'All time', value: 'all' },
]

export default function DashboardPage() {
  const supabase = createClient()
  const [deals, setDeals] = useState<Deal[]>([])
  const [range, setRange] = useState<DateRange>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchDeals = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('deals').select('*').order('created_at', { ascending: false })

    let from: Date | null = null
    const to = new Date()
    if (range === '7d') from = subDays(to, 7)
    else if (range === '30d') from = subDays(to, 30)
    else if (range === '90d') from = subDays(to, 90)
    else if (range === 'ytd') from = startOfYear(to)
    else if (range === 'custom') {
      if (customFrom) from = new Date(customFrom)
    }

    if (from) query = query.gte('created_at', from.toISOString())
    if (range === 'custom' && customTo) query = query.lte('created_at', new Date(customTo).toISOString())

    const { data } = await query
    setDeals(data || [])
    setLoading(false)
  }, [range, customFrom, customTo])

  useEffect(() => { fetchDeals() }, [fetchDeals])

  // KPI aggregations
  const sum = (key: keyof Deal) => deals.reduce((a, d) => a + (Number(d[key]) || 0), 0)
  const assigned = deals.filter(d => d.pipeline === 'assigned' || d.pipeline === 'closed')
  const closed = deals.filter(d => d.pipeline === 'closed')
  const active = deals.filter(d => !['closed'].includes(d.pipeline))
  const cancelled = deals.filter(d => d.stage === 'Dead' || d.pipeline === 'ghosted')
  const projProfit = active.reduce((a, d) => a + parseMoney(d.projected_profit), 0)
  const closedProfit = closed.reduce((a, d) => a + parseMoney(d.closed_for || d.projected_profit), 0)

  const kpiCards = [
    { label: 'Dials', value: sum('kpi_dials').toLocaleString(), color: 'var(--blue)' },
    { label: 'Talk Time (min)', value: sum('kpi_talk_time').toLocaleString(), color: 'var(--blue)' },
    { label: 'New Buyers Qualified', value: sum('kpi_new_buyers').toLocaleString(), color: 'var(--accent)' },
    { label: 'Offers', value: sum('kpi_offers').toLocaleString(), color: 'var(--amber)' },
    { label: 'Walkthroughs', value: sum('kpi_walkthroughs').toLocaleString(), color: 'var(--amber)' },
    { label: 'Assignments', value: assigned.length, color: 'var(--accent)' },
    { label: 'Open Contracts', value: active.length, color: 'var(--blue)' },
    { label: 'Closed Contracts', value: closed.length, color: 'var(--purple)' },
    { label: 'Projected Profit', value: `$${Math.round(projProfit / 1000)}k`, color: 'var(--accent)', sub: 'open deals' },
    { label: 'Closed Profit', value: `$${Math.round(closedProfit / 1000)}k`, color: 'var(--purple)', sub: 'realized' },
    { label: 'Cancelled', value: cancelled.length, color: 'var(--red)' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>Dashboard</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>performance overview</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
        {/* Date Range */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>Range:</span>
          {RANGES.map(r => (
            <button key={r.value} onClick={() => setRange(r.value)} style={{
              padding: '5px 12px', borderRadius: '7px', border: '1px solid',
              borderColor: range === r.value ? 'var(--accent-border)' : 'var(--border2)',
              background: range === r.value ? 'var(--accent-dim)' : 'var(--bg3)',
              color: range === r.value ? 'var(--accent)' : 'var(--text2)',
              cursor: 'pointer', fontSize: '11px', fontWeight: 500, transition: 'all 0.12s'
            }}>{r.label}</button>
          ))}
          <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setRange('custom') }}
            className="input-base" style={{ width: 'auto', fontSize: '11px', padding: '5px 10px' }}/>
          <span style={{ color: 'var(--text3)', fontSize: '11px' }}>to</span>
          <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setRange('custom') }}
            className="input-base" style={{ width: 'auto', fontSize: '11px', padding: '5px 10px' }}/>
        </div>

        {/* KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '12px', marginBottom: '28px' }}>
          {kpiCards.map(k => (
            <div key={k.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '13px', padding: '16px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>{k.label}</div>
              <div style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', color: k.color }}>{loading ? '—' : k.value}</div>
              {k.sub && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px' }}>{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* Active Deals Table */}
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>
          Deals in Range
        </div>
        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: '12px' }}>Loading...</div>
        ) : deals.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: '12px', padding: '20px 0' }}>No deals in this date range.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                {['Address', 'Pipeline', 'Stage', 'Asking', 'Proj. Profit', 'Dials', 'Offers'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '7px 10px', fontSize: '10px', color: 'var(--text3)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map(d => (
                <tr key={d.id} style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{d.address}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{
                      fontSize: '10px', padding: '2px 7px', borderRadius: '99px', fontWeight: 600,
                      fontFamily: 'var(--font-mono)', background: 'var(--bg4)', color: 'var(--text2)'
                    }}>{PIPELINES[d.pipeline as keyof typeof PIPELINES]?.label || d.pipeline}</span>
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontSize: '11px' }}>{d.stage}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>{d.asking_price || '—'}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>{d.projected_profit || '—'}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>{d.kpi_dials}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>{d.kpi_offers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
