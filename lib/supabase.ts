import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ─── Pipeline & Task Definitions ────────────────────────────────
export const PIPELINES = {
  general: {
    label: 'General',
    color: 'blue',
    stages: ['Under Contract', 'Marketing', 'Assigned', 'In Title', 'Closed', 'Dead'],
    tasksByStage: {} as Record<string, string[]>,
  },
  uc_indepth: {
    label: 'Under Contract (In-Depth)',
    color: 'amber',
    stages: ['Day of Contract (24hr)', 'Day After Contract'],
    tasksByStage: {
      'Day of Contract (24hr)': [
        'Dispo Asst — Check CRM for missing info; contact Acquisitions Agent to fill in',
        'Dispo Asst — Check Emergency Notes (EMD Amount, Inspection/Close Days)',
        'Dispo Asst — Confirm Purchase Agreement uploaded; verify pricing, address, name, inspection/closing days',
        'Dispo Agent — Make Welcome Call (Live Transfer) & Schedule Dates/Times for Photos',
      ],
      'Day After Contract': [
        'Pull Cash Buyers list',
        'Pull Listing Agents of Pending and Sold Flips',
        'Pull Buyers Agents of cash buys on MLS',
        'Pull Property Management Companies',
        'Pull Landlords from Zillow rental comps',
        'Create Marketing Material',
        'Make sure Pre-Marketing Text is ready to send',
      ],
    },
  },
  marketing: {
    label: 'Marketing',
    color: 'purple',
    stages: [
      'Day 1 — After Photos Received', 'Day 2–3', 'Day 4', 'Day 5', 'Day 6',
      'Day 7', 'Day 8', 'Day 9', 'Day 10', 'Day 11–12', 'Day 13', 'Day 14',
      'Day 15', 'Buyer Found', 'Reduction Needed',
    ],
    tasksByStage: {
      'Day 1 — After Photos Received': [
        'Send Text/Email to Entire Buyers List',
        'Call New Targeted Buyers',
        'Call VIP Buyer Data (1)',
        'Follow-up with interested buyers from pre-marketing text in Buyers tab',
        'List on Flat Fee MLS if Rural or Mobile Home',
      ],
      'Day 2–3': ['Finish Calls and Follow-ups (1)'],
      'Day 4': ['List with 1% Agent or Book Flat Fee Broker', 'Fill out paperwork for Flat Fee Broker', 'Call Through Buyers Tab (2)'],
      'Day 5': ['Follow-Up Interested Buyers (2)'],
      'Day 6': ['Send Out Reduced Messages on All Platforms (Except MLS) (1)', 'Send Out Reduced on MLS if Listed Day 1 (1)', 'Follow-Up Buyers (3)'],
      'Day 7': ['Follow-Up Buyers (4)'],
      'Day 8': ['Reduce on MLS (1)'],
      'Day 9': ['Follow-Up Buyers (5)'],
      'Day 10': ['Reduce All Platforms (2)'],
      'Day 11–12': ['Follow-Up Buyers (6)'],
      'Day 13': ['Reduce on MLS (2)'],
      'Day 14': ['Follow-Up Buyers (7)'],
      'Day 15': ['Confirm All Offers — Get Best and Final — Reduction with Seller if Needed to Assign'],
      'Buyer Found': ['Get assignment contract signed', 'Send Title email', 'Get EMD in'],
      'Reduction Needed': ['Prep for reduction call', 'Go in for reduction call with seller'],
    },
  },
  assigned: {
    label: 'Assigned',
    color: 'green',
    stages: ['TC Work'],
    tasksByStage: { 'TC Work': [] },
  },
  closed: {
    label: 'Closed',
    color: 'teal',
    stages: ['Update Closed Info'],
    tasksByStage: {
      'Update Closed Info': [
        'Enter Date of Close',
        'Enter Realized Revenue',
        'Record CC From (pipeline/stage deal came from)',
        'Record CC From (date contract was signed)',
      ],
    },
  },
  ghosted: {
    label: 'Seller Ghosted',
    color: 'red',
    stages: ['Day 1', 'Day 2', 'Day 3'],
    tasksByStage: {
      'Day 1': ['File affidavit', 'Call from every number in system', 'Call from CallRail', 'Call from personal number', 'Send text'],
      'Day 2': ['Call from every number in system', 'Call from CallRail', 'Call from personal number', 'Send text'],
      'Day 3': ['Call from every number in system', 'Call from CallRail', 'Call from personal number', 'Send meme', 'Add to Aff. Filed drip in GHL'],
    },
  },
} as const

export type PipelineKey = keyof typeof PIPELINES

export const PIPELINE_COLORS: Record<string, string> = {
  general: '#4f9eff',
  uc_indepth: '#f5a623',
  marketing: '#a78bfa',
  assigned: '#22d98e',
  closed: '#2dd4bf',
  ghosted: '#f05a5a',
}

// ─── Types ─────────────────────────────────────────────────────
export type Profile = {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'agent'
  avatar_url: string | null
}

export type Deal = {
  id: string
  created_by: string
  assigned_to: string | null
  address: string
  pipeline: string
  stage: string
  tx_type: string | null
  asking_price: string | null
  contract_amount: string | null
  projected_profit: string | null
  assigned_for: string | null
  closed_for: string | null
  closing_date: string | null
  inspection_days: number | null
  title_company: string | null
  seller_name: string | null
  seller_phone: string | null
  seller_email: string | null
  seller_available_hours: string | null
  tc_seller_day: string | null
  tc_seller_time: string | null
  buyer_name: string | null
  buyer_phone: string | null
  buyer_email: string | null
  buyer_realtor: string | null
  realtor_email: string | null
  realtor_phone: string | null
  tc_buyer_day: string | null
  tc_buyer_time: string | null
  tc_title_day: string | null
  tc_title_time: string | null
  kpi_dials: number
  kpi_talk_time: number
  kpi_new_buyers: number
  kpi_offers: number
  kpi_walkthroughs: number
  notes: string | null
  created_at: string
  updated_at: string
  tasks?: Task[]
  deal_notes?: DealNote[]
}

export type Task = {
  id: string
  deal_id: string
  stage: string
  text: string
  description: string | null
  done: boolean
  deadline: string | null
  due_time: string | null
  auto_generated: boolean
  completed_by: string | null
  completed_at: string | null
}

export type DealNote = {
  id: string
  deal_id: string
  author_id: string
  text: string
  created_at: string
  profiles?: Profile
}

export type Buyer = {
  id: string
  first_name: string
  last_name: string | null
  phone: string | null
  email: string | null
  company: string | null
  rank: 'VIP' | 'Qualified' | 'Unqualified'
  buyer_type: string | null
  price_range: string | null
  city: string | null
  zip_codes: string | null
  counties: string | null
  close_timeline: string | null
  proof_of_funds: string | null
  tags: string[]
  notes: string | null
  created_at: string
}

export type TitleCompany = {
  id: string
  created_by: string | null
  name: string
  state: string
  counties_covered: string | null
  deals_done: number
  deal_types: string[]
  escrow_officer: string | null
  email: string | null
  phone: string | null
  hours_of_operation: string | null
  days_of_operation: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ActivityLog = {
  id: string
  user_id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  entity_label: string | null
  meta: Record<string, unknown> | null
  created_at: string
  profiles?: Profile
}

// ─── Helpers ────────────────────────────────────────────────────
export function getDeadline(hoursFromNow = 24): string {
  const d = new Date()
  d.setHours(d.getHours() + hoursFromNow)
  return d.toISOString().split('T')[0]
}

export function parseMoney(str: string | null | undefined): number {
  if (!str) return 0
  return parseFloat(String(str).replace(/[$,k]/gi, s => s.toLowerCase() === 'k' ? '000' : '')) || 0
}

export async function logActivity(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  entityLabel: string,
  meta?: Record<string, unknown>
) {
  await supabase.from('activity_log').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_label: entityLabel,
    meta,
  })
}
