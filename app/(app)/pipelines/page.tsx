'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient, PIPELINES, PIPELINE_COLORS, getDeadline, logActivity, type Deal, type Task, type DealNote, type PipelineKey } from '@/lib/supabase'
import { format } from 'date-fns'

type PipKey = keyof typeof PIPELINES

export default function PipelinesPage() {
  const supabase = createClient()
  const [currentPip, setCurrentPip] = useState<PipKey>('general')
  const [deals, setDeals] = useState<Deal[]>([])
  const [tasks, setTasks] = useState<Record<string, Task[]>>({})
  const [loading, setLoading] = useState(true)
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'tasks' | 'kpis' | 'notes'>('info')
  const [dealNotes, setDealNotes] = useState<DealNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [showAddDeal, setShowAddDeal] = useState(false)
  const [showMove, setShowMove] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [toast, setToast] = useState('')

  // Add Deal form state
  const [nd, setNd] = useState({ addr: '', pipeline: 'general' as PipKey, stage: '', txType: 'Wholesale Assignment', asking: '', sName: '', sPhone: '', sEmail: '', contract: '', profit: '', closedate: '', inspection: '', notes: '' })
  // Move form state
  const [mv, setMv] = useState({ pipeline: 'general' as PipKey, stage: '', tcSellerDay: 'Monday', tcSellerTime: '10:00', tcBuyerDay: 'Tuesday', tcBuyerTime: '14:00', tcTitleDay: 'Monday', tcTitleTime: '09:00' })

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const loadDeals = useCallback(async () => {
    const { data } = await supabase.from('deals').select('*').order('created_at', { ascending: false })
    setDeals(data || [])
    setLoading(false)
    // Load tasks for all deals
    if (data?.length) {
      const { data: taskData } = await supabase.from('tasks').select('*').in('deal_id', data.map(d => d.id))
      const grouped: Record<string, Task[]> = {}
      taskData?.forEach(t => { if (!grouped[t.deal_id]) grouped[t.deal_id] = []; grouped[t.deal_id].push(t) })
      setTasks(grouped)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id) })
    loadDeals()
    // Realtime
    const ch = supabase.channel('deals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, loadDeals)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadDeals)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadDeals])

  async function createTasksForStage(dealId: string, pipeline: string, stage: string) {
    const pip = PIPELINES[pipeline as PipKey]
    const stageTasks: string[] = (pip?.tasksByStage?.[stage as keyof typeof pip.tasksByStage] as string[] | undefined) || []
    if (!stageTasks.length) return
    const deadline = getDeadline(24)
    const toInsert = (stageTasks as string[]).map(text => ({
      deal_id: dealId, stage, text, done: false, deadline, auto_generated: true
    }))
    await supabase.from('tasks').insert(toInsert)
  }

  async function createTCTasks(dealId: string, tcInfo: typeof mv) {
    const weeks = 8
    const now = new Date()
    const toInsert = []
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    for (let w = 0; w < weeks; w++) {
      for (const [party, dayKey, timeKey] of [['Seller', 'tcSellerDay', 'tcSellerTime'], ['Buyer', 'tcBuyerDay', 'tcBuyerTime'], ['Title', 'tcTitleDay', 'tcTitleTime']] as const) {
        const day = (tcInfo as any)[dayKey]
        const time = (tcInfo as any)[timeKey]
        const dayIdx = dayNames.indexOf(day)
        const taskDate = new Date(now)
        const curDay = taskDate.getDay()
        let diff = dayIdx - curDay + w * 7
        if (diff < 0) diff += 7
        taskDate.setDate(taskDate.getDate() + diff)
        toInsert.push({
          deal_id: dealId, stage: 'TC Work',
          text: `Week ${w + 1} — ${party} TC ${party === 'Title' ? 'Email' : 'Call'} (${day}s @ ${time})`,
          done: false, deadline: taskDate.toISOString().split('T')[0], auto_generated: true
        })
      }
    }
    await supabase.from('tasks').insert(toInsert)
  }

  async function saveDeal() {
    if (!nd.addr.trim()) { showToast('Address is required'); return }
    const stage = nd.stage || PIPELINES[nd.pipeline].stages[0]
    const { data, error } = await supabase.from('deals').insert({
      created_by: userId, address: nd.addr, pipeline: nd.pipeline, stage,
      tx_type: nd.txType, asking_price: nd.asking, seller_name: nd.sName,
      seller_phone: nd.sPhone, seller_email: nd.sEmail, contract_amount: nd.contract,
      projected_profit: nd.profit, closing_date: nd.closedate || null,
      inspection_days: nd.inspection ? parseInt(nd.inspection) : null, notes: nd.notes,
    }).select().single()
    if (error || !data) { showToast('Error saving deal'); return }
    await createTasksForStage(data.id, nd.pipeline, stage)
    await logActivity(supabase, userId, 'created a deal', 'deal', data.id, nd.addr)
    setShowAddDeal(false)
    setNd({ addr: '', pipeline: 'general', stage: '', txType: 'Wholesale Assignment', asking: '', sName: '', sPhone: '', sEmail: '', contract: '', profit: '', closedate: '', inspection: '', notes: '' })
    showToast('Deal added ✓')
  }

  async function executeDealMove() {
    if (!activeDeal) return
    const stage = mv.stage || PIPELINES[mv.pipeline].stages[0]
    const updates: Partial<Deal> = { pipeline: mv.pipeline, stage }
    if (mv.pipeline === 'assigned') {
      Object.assign(updates, { tc_seller_day: mv.tcSellerDay, tc_seller_time: mv.tcSellerTime, tc_buyer_day: mv.tcBuyerDay, tc_buyer_time: mv.tcBuyerTime, tc_title_day: mv.tcTitleDay, tc_title_time: mv.tcTitleTime })
    }
    await supabase.from('deals').update(updates).eq('id', activeDeal.id)
    // Clear old auto tasks for this stage, create new ones
    await supabase.from('tasks').delete().eq('deal_id', activeDeal.id).eq('auto_generated', true)
    if (mv.pipeline === 'assigned') {
      await createTCTasks(activeDeal.id, mv)
    } else {
      await createTasksForStage(activeDeal.id, mv.pipeline, stage)
    }
    await logActivity(supabase, userId, `moved deal to ${PIPELINES[mv.pipeline].label} → ${stage}`, 'deal', activeDeal.id, activeDeal.address)
    setShowMove(false)
    setActiveDeal(prev => prev ? { ...prev, pipeline: mv.pipeline, stage } : null)
    showToast('Deal moved ✓')
  }

  async function updateDealField(field: string, value: string | number) {
    if (!activeDeal) return
    await supabase.from('deals').update({ [field]: value }).eq('id', activeDeal.id)
    setActiveDeal(prev => prev ? { ...prev, [field]: value } : null)
    setDeals(prev => prev.map(d => d.id === activeDeal.id ? { ...d, [field]: value } : d))
  }

  async function toggleTask(taskId: string) {
    const allTasks = Object.values(tasks).flat()
    const task = allTasks.find(t => t.id === taskId)
    if (!task) return
    const done = !task.done
    await supabase.from('tasks').update({ done, completed_by: done ? userId : null, completed_at: done ? new Date().toISOString() : null }).eq('id', taskId)
    setTasks(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(dealId => {
        next[dealId] = next[dealId].map(t => t.id === taskId ? { ...t, done } : t)
      })
      return next
    })
  }

  async function openDeal(deal: Deal) {
    setActiveDeal(deal)
    setActiveTab('info')
    // Load notes
    const { data } = await supabase.from('deal_notes').select('*, profiles(full_name, email)').eq('deal_id', deal.id).order('created_at')
    setDealNotes(data || [])
  }

  async function addNote() {
    if (!newNote.trim() || !activeDeal) return
    const { data } = await supabase.from('deal_notes').insert({ deal_id: activeDeal.id, author_id: userId, text: newNote.trim() }).select('*, profiles(full_name, email)').single()
    if (data) setDealNotes(prev => [...prev, data])
    setNewNote('')
  }

  async function deleteDeal() {
    if (!activeDeal) return
    if (!confirm('Delete this deal? This cannot be undone.')) return
    await supabase.from('deals').delete().eq('id', activeDeal.id)
    await logActivity(supabase, userId, 'deleted a deal', 'deal', activeDeal.id, activeDeal.address)
    setActiveDeal(null)
    showToast('Deal deleted')
  }

  const pipDeals = deals.filter(d => d.pipeline === currentPip)
  const pip = PIPELINES[currentPip]
  const dealTasks = activeDeal ? (tasks[activeDeal.id] || []) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>Pipelines</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>manage all deals</div>
        </div>
        <button onClick={() => setShowAddDeal(true)} style={{ padding: '7px 14px', borderRadius: '8px', background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
          + Add Deal
        </button>
      </div>

      {/* Pipeline Selector */}
      <div style={{ display: 'flex', gap: '6px', padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0, flexWrap: 'wrap' }}>
        {(Object.keys(PIPELINES) as PipKey[]).map(key => {
          const count = deals.filter(d => d.pipeline === key).length
          const isActive = currentPip === key
          const color = PIPELINE_COLORS[key]
          return (
            <button key={key} onClick={() => setCurrentPip(key)} style={{
              padding: '5px 13px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 500, transition: 'all 0.12s',
              background: isActive ? `${color}18` : 'var(--bg2)',
              color: isActive ? color : 'var(--text3)',
              border: `1px solid ${isActive ? `${color}44` : 'var(--border)'}`,
            }}>
              {PIPELINES[key].label}{count > 0 ? ` (${count})` : ''}
            </button>
          )
        })}
      </div>

      {/* Board */}
      <div className="pipeline-scroll" style={{ flex: 1 }}>
        {pip.stages.map(stage => {
          const stageDeals = pipDeals.filter(d => d.stage === stage)
          return (
            <div key={stage} style={{ minWidth: '210px', maxWidth: '210px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '13px', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--font-mono)' }}>{stage}</span>
                <span style={{ fontSize: '10px', background: 'var(--bg4)', color: 'var(--text3)', borderRadius: '99px', padding: '1px 7px', fontFamily: 'var(--font-mono)' }}>{stageDeals.length}</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {stageDeals.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px 4px', fontSize: '11px', color: 'var(--text4)' }}>No deals</div>
                ) : stageDeals.map(deal => {
                  const dt = tasks[deal.id] || []
                  const done = dt.filter(t => t.done).length
                  const overdue = dt.filter(t => !t.done && t.deadline && t.deadline < new Date().toISOString().split('T')[0]).length
                  return (
                    <div key={deal.id} onClick={() => openDeal(deal)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '9px', padding: '10px 11px', marginBottom: '7px', cursor: 'pointer', transition: 'all 0.12s', position: 'relative', overflow: 'hidden' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg4)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                      <div className="deal-stripe" style={{ background: PIPELINE_COLORS[deal.pipeline] }} />
                      <div style={{ fontSize: '12px', fontWeight: 600, paddingLeft: '8px', marginBottom: '5px', lineHeight: 1.3 }}>{deal.address}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{deal.asking_price || '—'}</span>
                        <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{deal.projected_profit || ''}</span>
                      </div>
                      {dt.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', paddingLeft: '8px', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                          {overdue > 0 && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--red)' }}/>}
                          {done < dt.length && !overdue && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text4)' }}/>}
                          {done === dt.length && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }}/>}
                          <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{done}/{dt.length} tasks{overdue ? ` · ${overdue} overdue` : ''}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <button onClick={() => { setNd(p => ({ ...p, pipeline: currentPip, stage })); setShowAddDeal(true) }} style={{ margin: '0 8px 8px', padding: '6px', borderRadius: '8px', border: '1px dashed var(--border2)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: '11px', transition: 'all 0.12s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = PIPELINE_COLORS[currentPip]; (e.currentTarget as HTMLElement).style.color = PIPELINE_COLORS[currentPip] }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text3)' }}>
                + Add deal
              </button>
            </div>
          )
        })}
      </div>

      {/* DEAL DETAIL PANEL */}
      {activeDeal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', backdropFilter: 'blur(3px)' }} onClick={e => { if (e.target === e.currentTarget) setActiveDeal(null) }}>
          <div className="animate-slide-in" style={{ width: '700px', maxWidth: '96vw', background: 'var(--bg2)', borderLeft: '1px solid var(--border2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Panel Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: '12px', flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '3px' }}>{activeDeal.address}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                  {PIPELINES[activeDeal.pipeline as PipKey]?.label} → {activeDeal.stage}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => { setMv({ pipeline: activeDeal.pipeline as PipKey, stage: activeDeal.stage, tcSellerDay: 'Monday', tcSellerTime: '10:00', tcBuyerDay: 'Tuesday', tcBuyerTime: '14:00', tcTitleDay: 'Monday', tcTitleTime: '09:00' }); setShowMove(true) }} className="btn-base" style={{ fontSize: '11px', padding: '5px 10px' }}>Move</button>
                <button onClick={deleteDeal} className="btn-base" style={{ fontSize: '11px', padding: '5px 10px', background: 'var(--red-dim)', color: 'var(--red)', borderColor: 'rgba(240,90,90,0.25)' }}>Delete</button>
                <button onClick={() => setActiveDeal(null)} className="btn-base" style={{ fontSize: '11px', padding: '5px 10px', background: 'transparent', border: 'none', color: 'var(--text3)' }}>✕</button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px', flexShrink: 0 }}>
              {(['info', 'tasks', 'kpis', 'notes'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`, color: activeTab === tab ? 'var(--accent)' : 'var(--text3)', marginBottom: '-1px', transition: 'all 0.12s', textTransform: 'capitalize' }}>
                  {tab}{tab === 'tasks' && dealTasks.length ? ` (${dealTasks.filter(t => !t.done).length})` : ''}
                </button>
              ))}
            </div>

            {/* Panel Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

              {/* INFO TAB */}
              {activeTab === 'info' && (
                <div>
                  {[
                    { title: 'Transaction', fields: [
                      { label: 'Type', key: 'tx_type', type: 'select', options: ['Wholesale Assignment', 'Double Close', 'Novation', 'Subject-To', 'Wholetail'] },
                      { label: 'Asking Price', key: 'asking_price' },
                      { label: 'Contract Amount', key: 'contract_amount' },
                      { label: 'Projected Profit', key: 'projected_profit' },
                      { label: 'Assigned For', key: 'assigned_for' },
                      { label: 'Closed For', key: 'closed_for' },
                      { label: 'Closing Date', key: 'closing_date', type: 'date' },
                      { label: 'Inspection Days', key: 'inspection_days', type: 'number' },
                      { label: 'Title Company', key: 'title_company' },
                      { label: 'Seller Available Hours', key: 'seller_available_hours' },
                    ]},
                    { title: 'Seller', fields: [
                      { label: 'Seller Name', key: 'seller_name' },
                      { label: 'Seller Phone', key: 'seller_phone' },
                      { label: 'Seller Email', key: 'seller_email' },
                      { label: 'TC Call Day', key: 'tc_seller_day' },
                      { label: 'TC Call Time', key: 'tc_seller_time', type: 'time' },
                    ]},
                    { title: 'Buyer', fields: [
                      { label: 'Buyer Name', key: 'buyer_name' },
                      { label: 'Buyer Phone', key: 'buyer_phone' },
                      { label: 'Buyer Email', key: 'buyer_email' },
                      { label: "Buyer's Realtor", key: 'buyer_realtor' },
                      { label: "Realtor's Email", key: 'realtor_email' },
                      { label: "Realtor's Phone", key: 'realtor_phone' },
                      { label: 'Buyer TC Day', key: 'tc_buyer_day' },
                      { label: 'Buyer TC Time', key: 'tc_buyer_time', type: 'time' },
                      { label: 'Title TC Day', key: 'tc_title_day' },
                      { label: 'Title TC Time', key: 'tc_title_time', type: 'time' },
                    ]},
                  ].map(section => (
                    <div key={section.title} style={{ marginBottom: '24px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>{section.title}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {section.fields.map(f => (
                          <div key={f.key}>
                            <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>{f.label}</div>
                            {f.type === 'select' ? (
                              <select className="input-base" value={(activeDeal as any)[f.key] || ''} onChange={e => updateDealField(f.key, e.target.value)} style={{ cursor: 'pointer' }}>
                                {f.options?.map(o => <option key={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input className="input-base" type={f.type || 'text'} value={(activeDeal as any)[f.key] || ''} onChange={e => updateDealField(f.key, e.target.value)} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>Notes</div>
                    <textarea className="input-base" rows={4} value={activeDeal.notes || ''} onChange={e => updateDealField('notes', e.target.value)} style={{ resize: 'vertical' }} />
                  </div>
                </div>
              )}

              {/* TASKS TAB */}
              {activeTab === 'tasks' && (
                <div>
                  {dealTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)' }}>
                      <div style={{ fontSize: '28px', marginBottom: '10px' }}>✓</div>
                      <div style={{ fontSize: '14px', color: 'var(--text2)', fontWeight: 600, marginBottom: '5px' }}>No tasks</div>
                      <div style={{ fontSize: '12px' }}>Tasks auto-populate when a deal is in a stage with defined tasks.</div>
                    </div>
                  ) : (() => {
                    const byStage: Record<string, Task[]> = {}
                    dealTasks.forEach(t => { if (!byStage[t.stage]) byStage[t.stage] = []; byStage[t.stage].push(t) })
                    return Object.entries(byStage).map(([stage, stageTasks]) => (
                      <div key={stage} style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>{stage}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {stageTasks.map(task => {
                            const today = new Date().toISOString().split('T')[0]
                            const overdue = task.deadline && task.deadline < today && !task.done
                            const dueToday = task.deadline === today && !task.done
                            return (
                              <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '9px', opacity: task.done ? 0.5 : 1 }}>
                                <div onClick={() => toggleTask(task.id)} style={{ width: '16px', height: '16px', borderRadius: '4px', border: `1px solid ${task.done ? 'var(--accent)' : overdue ? 'var(--red)' : 'var(--border3)'}`, background: task.done ? 'var(--accent)' : 'var(--bg4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px', transition: 'all 0.12s' }}>
                                  {task.done && <span style={{ fontSize: '10px', color: '#000', fontWeight: 700 }}>✓</span>}
                                </div>
                                <div style={{ flex: 1, fontSize: '12px', textDecoration: task.done ? 'line-through' : 'none', color: task.done ? 'var(--text3)' : 'var(--text)' }}>{task.text}</div>
                                {task.deadline && (
                                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: overdue ? 'var(--red)' : dueToday ? 'var(--amber)' : 'var(--text3)', whiteSpace: 'nowrap' }}>
                                    {overdue ? 'Overdue · ' : dueToday ? 'Due today · ' : ''}{task.deadline}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              )}

              {/* KPIs TAB */}
              {activeTab === 'kpis' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '16px' }}>
                    {[
                      { key: 'kpi_dials', label: 'Dials' },
                      { key: 'kpi_talk_time', label: 'Talk Time (min)' },
                      { key: 'kpi_new_buyers', label: 'New Buyers' },
                      { key: 'kpi_offers', label: 'Offers' },
                      { key: 'kpi_walkthroughs', label: 'Walkthroughs' },
                    ].map(k => (
                      <div key={k.key} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '9px', padding: '12px 8px', textAlign: 'center' }}>
                        <input type="number" min="0" value={(activeDeal as any)[k.key] || 0} onChange={e => updateDealField(k.key, parseInt(e.target.value) || 0)} style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'center', fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', outline: 'none' }} />
                        <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>{k.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', lineHeight: 1.8 }}>Click any number above to edit. These roll up to the Dashboard automatically.</div>
                </div>
              )}

              {/* NOTES TAB */}
              {activeTab === 'notes' && (
                <div>
                  {dealNotes.map(note => (
                    <div key={note.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '9px', padding: '10px 12px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
                        {note.profiles?.full_name || note.profiles?.email || 'You'} · {format(new Date(note.created_at), 'MMM d, h:mm a')}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.6 }}>{note.text}</div>
                    </div>
                  ))}
                  {dealNotes.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '14px' }}>No notes yet.</div>}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." rows={2} className="input-base" style={{ flex: 1, resize: 'none' }} onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addNote() }} />
                    <button onClick={addNote} style={{ padding: '8px 14px', borderRadius: '8px', background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, alignSelf: 'flex-end' }}>Add</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD DEAL MODAL */}
      {showAddDeal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) setShowAddDeal(false) }}>
          <div className="animate-modal-in" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '14px', padding: '22px 24px', width: '520px', maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700 }}>Add New Deal</div>
              <button onClick={() => setShowAddDeal(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            <div style={{ marginBottom: '13px' }}><label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Property Address *</label><input className="input-base" value={nd.addr} onChange={e => setNd(p => ({ ...p, addr: e.target.value }))} placeholder="123 Main St, Dallas TX 75201" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '13px' }}>
              <div><label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pipeline</label>
                <select className="input-base" value={nd.pipeline} onChange={e => { const p = e.target.value as PipKey; setNd(prev => ({ ...prev, pipeline: p, stage: PIPELINES[p].stages[0] })) }} style={{ cursor: 'pointer' }}>
                  {(Object.keys(PIPELINES) as PipKey[]).map(k => <option key={k} value={k}>{PIPELINES[k].label}</option>)}
                </select>
              </div>
              <div><label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Stage</label>
                <select className="input-base" value={nd.stage || PIPELINES[nd.pipeline].stages[0]} onChange={e => setNd(p => ({ ...p, stage: e.target.value }))} style={{ cursor: 'pointer' }}>
                  {PIPELINES[nd.pipeline].stages.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '13px' }}>
              <div><label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Asking Price</label><input className="input-base" value={nd.asking} onChange={e => setNd(p => ({ ...p, asking: e.target.value }))} placeholder="$12,000" /></div>
              <div><label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Projected Profit</label><input className="input-base" value={nd.profit} onChange={e => setNd(p => ({ ...p, profit: e.target.value }))} placeholder="$12,000" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '13px' }}>
              <div><label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Seller Name</label><input className="input-base" value={nd.sName} onChange={e => setNd(p => ({ ...p, sName: e.target.value }))} placeholder="John Smith" /></div>
              <div><label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Seller Phone</label><input className="input-base" value={nd.sPhone} onChange={e => setNd(p => ({ ...p, sPhone: e.target.value }))} placeholder="(555) 000-0000" /></div>
            </div>
            <div style={{ marginBottom: '13px' }}><label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Contract Amount</label><input className="input-base" value={nd.contract} onChange={e => setNd(p => ({ ...p, contract: e.target.value }))} placeholder="$95,000" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '13px' }}>
              <div><label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Closing Date</label><input type="date" className="input-base" value={nd.closedate} onChange={e => setNd(p => ({ ...p, closedate: e.target.value }))} /></div>
              <div><label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Inspection Days</label><input type="number" className="input-base" value={nd.inspection} onChange={e => setNd(p => ({ ...p, inspection: e.target.value }))} placeholder="10" /></div>
            </div>
            <div style={{ marginBottom: '18px' }}><label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Notes</label><textarea className="input-base" rows={3} value={nd.notes} onChange={e => setNd(p => ({ ...p, notes: e.target.value }))} placeholder="EMD, emergency notes..." style={{ resize: 'none' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowAddDeal(false)} className="btn-base">Cancel</button>
              <button onClick={saveDeal} style={{ padding: '7px 16px', borderRadius: '8px', background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Add Deal</button>
            </div>
          </div>
        </div>
      )}

      {/* MOVE DEAL MODAL */}
      {showMove && activeDeal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) setShowMove(false) }}>
          <div className="animate-modal-in" style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '14px', padding: '22px 24px', width: '420px', maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700 }}>Move Deal</div>
              <button onClick={() => setShowMove(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            <div style={{ marginBottom: '13px' }}><label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pipeline</label>
              <select className="input-base" value={mv.pipeline} onChange={e => { const p = e.target.value as PipKey; setMv(prev => ({ ...prev, pipeline: p, stage: PIPELINES[p].stages[0] })) }} style={{ cursor: 'pointer' }}>
                {(Object.keys(PIPELINES) as PipKey[]).map(k => <option key={k} value={k}>{PIPELINES[k].label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '13px' }}><label style={{ fontSize: '10px', color: 'var(--text3)', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Stage</label>
              <select className="input-base" value={mv.stage || PIPELINES[mv.pipeline].stages[0]} onChange={e => setMv(p => ({ ...p, stage: e.target.value }))} style={{ cursor: 'pointer' }}>
                {PIPELINES[mv.pipeline].stages.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            {mv.pipeline === 'assigned' && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--font-mono)', margin: '14px 0 10px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>TC Schedule</div>
                {[
                  { label: 'Weekly Seller TC Call', dayKey: 'tcSellerDay', timeKey: 'tcSellerTime' },
                  { label: 'Weekly Buyer TC Call', dayKey: 'tcBuyerDay', timeKey: 'tcBuyerTime' },
                  { label: 'Weekly Title TC Email', dayKey: 'tcTitleDay', timeKey: 'tcTitleTime' },
                ].map(tc => (
                  <div key={tc.dayKey} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '9px', padding: '12px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>{tc.label}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <select className="input-base" value={(mv as any)[tc.dayKey]} onChange={e => setMv(p => ({ ...p, [tc.dayKey]: e.target.value }))} style={{ cursor: 'pointer', fontSize: '12px' }}>
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => <option key={d}>{d}</option>)}
                      </select>
                      <input type="time" className="input-base" value={(mv as any)[tc.timeKey]} onChange={e => setMv(p => ({ ...p, [tc.timeKey]: e.target.value }))} style={{ fontSize: '12px' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button onClick={() => setShowMove(false)} className="btn-base">Cancel</button>
              <button onClick={executeDealMove} style={{ padding: '7px 16px', borderRadius: '8px', background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Move Deal</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', padding: '9px 16px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--accent-border)', color: 'var(--accent)', fontSize: '12px', fontWeight: 500, zIndex: 999 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
