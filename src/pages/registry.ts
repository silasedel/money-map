import type { ComponentType } from 'react'
import type { PageId } from '@/lib/types'
import type { IconName } from '@/components/Icon'
import { OverviewPage } from './overview/OverviewPage'
import { LedgerPage } from './ledger/LedgerPage'
import { SummaryPage } from './summary/SummaryPage'
import { SpendingPage } from './spending/SpendingPage'
import { SubscriptionsPage } from './subscriptions/SubscriptionsPage'
import { TaxesPage } from './taxes/TaxesPage'
import { GoalsPage } from './goals/GoalsPage'
import { MindMapPage } from './mindmap/MindMapPage'

export type Section = 'money' | 'plan'

export interface PageDef {
  id: PageId
  label: string
  icon: IconName
  Component: ComponentType
  section: Section
  /** Full-bleed pages own their own chrome (the mind map canvas does). */
  bleed?: boolean
}

/**
 * The single source of truth for navigation.
 * To add a page: build it, add a `PageId` to types.ts, append one entry here.
 */
export const PAGES: PageDef[] = [
  { id: 'overview', label: 'Overview', icon: 'home', Component: OverviewPage, section: 'money' },
  { id: 'ledger', label: 'Ledger', icon: 'ledger', Component: LedgerPage, section: 'money' },
  { id: 'summary', label: 'Summary', icon: 'outlook', Component: SummaryPage, section: 'money' },
  { id: 'spending', label: 'Budgets', icon: 'spending', Component: SpendingPage, section: 'money' },
  { id: 'subscriptions', label: 'Subscriptions', icon: 'subscriptions', Component: SubscriptionsPage, section: 'money' },
  { id: 'taxes', label: 'Taxes', icon: 'tax', Component: TaxesPage, section: 'money' },
  { id: 'goals', label: 'Goals', icon: 'goals', Component: GoalsPage, section: 'plan' },
  { id: 'mindmap', label: 'Mind Map', icon: 'mindmap', Component: MindMapPage, section: 'plan', bleed: true },
]

export const SECTIONS: { id: Section; label: string }[] = [
  { id: 'money', label: 'Money' },
  { id: 'plan', label: 'Plan' },
]

export const pageById = (id: PageId): PageDef =>
  PAGES.find((p) => p.id === id) ?? PAGES[0]
