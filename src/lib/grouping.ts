/**
 * Automatic transaction grouping.
 *
 * The user never maintains categories. Instead we cluster transactions by the
 * only thing they actually type — the title — using two passes:
 *
 *   1. A small lexicon snaps well-known concepts together, so "Shell",
 *      "Chevron" and "gas" all land in Fuel even though the strings share
 *      nothing.
 *   2. Everything else is clustered by string similarity, so "YouTube AdSense",
 *      "youtube adsense payout" and "Adsense" collapse into one group without
 *      anybody predefining it.
 *
 * Groups are derived on every read — there is no stored category to drift.
 */

import type { Transaction, TxKind } from './types'

/* ── Normalisation ────────────────────────────────────── */

/**
 * Only genuinely meaningless tokens belong here. Words like `bill`, `card`,
 * `fee`, `auto` and `payment` were once on this list, and stripping them broke
 * the multi-word entries that depend on them — a "gas bill" collapsed to "gas"
 * and got filed as motor fuel instead of heating.
 */
const NOISE = new Set([
  'the', 'a', 'an', 'of', 'for', 'from', 'to', 'and', 'my', 'me', 'on', 'at',
  'in', 'via', 'by', 'with', 'txn', 'ref', 'id', 'no', 'inc', 'llc', 'ltd',
  'co', 'corp', 'com', 'www', 'http', 'https', 'new', 'this', 'that', 'it',
  'is', 'was', 'x',
])

export function normalize(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t && !NOISE.has(t) && !/^\d+$/.test(t))
    .join(' ')
}

function tokens(normalized: string): string[] {
  return normalized ? normalized.split(' ') : []
}

/* ── Lexicon ──────────────────────────────────────────── */

/**
 * Concepts that string similarity provably cannot catch — different words for
 * the same thing. The list covers ordinary employment, freelance and trades,
 * creator income, retail, landlords and real estate, so it does useful work
 * whoever is typing. Anything not listed is still grouped, just by name.
 *
 * The longest matching key wins, which is what keeps overlapping terms honest:
 * "YouTube sponsorship" is a Sponsorship, not Ad Revenue, and a "gas bill" is
 * a utility while "gas" on its own is motor fuel.
 */
interface LexEntry {
  label: string
  kind?: TxKind
  keys: string[]
}

const LEXICON: LexEntry[] = [
  /* ── Inflow ─────────────────────────────────────────── */
  { label: 'Salary & Wages', kind: 'income', keys: ['salary', 'paycheck', 'pay check', 'payroll', 'wages', 'wage', 'direct deposit', 'base pay', 'hourly', 'overtime', 'shift pay', 'take home'] },
  { label: 'Bonus & Commission', kind: 'income', keys: ['bonus', 'commission', 'incentive', 'profit share', 'severance'] },
  { label: 'Tips', kind: 'income', keys: ['tip', 'tips', 'gratuity'] },
  { label: 'Freelance & Contract', kind: 'income', keys: ['freelance', 'client', 'contract work', 'consulting', 'retainer', 'gig', 'invoice', 'project fee', '1099', 'contractor'] },
  { label: 'Sponsorships', kind: 'income', keys: ['sponsor', 'sponsorship', 'brand deal', 'brand partnership', 'partnership', 'ad read', 'integration', 'collab', 'collaboration', 'endorsement', 'ambassador'] },
  { label: 'Ad Revenue', kind: 'income', keys: ['adsense', 'ad revenue', 'ad rev', 'monetization', 'youtube', 'twitch', 'creator fund', 'reels bonus', 'impressions', 'ad payout'] },
  { label: 'Product Sales', kind: 'income', keys: ['sale', 'sales', 'shopify', 'etsy', 'gumroad', 'stripe', 'ebay', 'merch', 'order', 'marketplace', 'wholesale', 'storefront'] },
  { label: 'Rental Income', kind: 'income', keys: ['rent received', 'rental income', 'tenant', 'lease income', 'airbnb payout', 'sublet', 'unit rent'] },
  { label: 'Real Estate', kind: 'income', keys: ['closing', 'escrow', 'listing commission', 'property sale', 'referral fee', 'appraisal fee'] },
  { label: 'Royalties', kind: 'income', keys: ['royalty', 'royalties', 'licensing', 'publishing', 'residual'] },
  { label: 'Investments', kind: 'income', keys: ['dividend', 'dividends', 'interest earned', 'capital gains', 'stocks', 'brokerage', 'crypto', 'staking', 'bond'] },
  { label: 'Refunds', kind: 'income', keys: ['refund', 'reimbursement', 'rebate', 'cashback', 'cash back', 'chargeback'] },
  { label: 'Benefits', kind: 'income', keys: ['unemployment', 'disability', 'social security', 'pension', 'annuity', 'stipend', 'grant', 'scholarship', 'financial aid', 'child support', 'alimony', 'benefits'] },
  { label: 'Tax Refund', kind: 'income', keys: ['tax refund', 'irs refund', 'return refund'] },
  { label: 'Gifts Received', kind: 'income', keys: ['gift', 'birthday money', 'donation received'] },

  /* ── Outflow ────────────────────────────────────────── */
  { label: 'Rent & Mortgage', keys: ['rent', 'mortgage', 'lease', 'landlord', 'hoa', 'property tax', 'escrow payment'] },
  { label: 'Utilities', keys: ['electric', 'electricity', 'water bill', 'gas bill', 'internet', 'wifi', 'phone bill', 'mobile bill', 'verizon', 'comcast', 'xfinity', 'spectrum', 't mobile', 'utility', 'utilities', 'heating', 'trash', 'sewer'] },
  { label: 'Groceries', keys: ['grocery', 'groceries', 'supermarket', 'whole foods', 'trader joe', 'safeway', 'kroger', 'aldi', 'costco', 'walmart', 'publix', 'wegmans', 'sprouts'] },
  { label: 'Dining Out', keys: ['restaurant', 'dinner', 'lunch', 'brunch', 'takeout', 'take out', 'doordash', 'ubereats', 'uber eats', 'grubhub', 'chipotle', 'mcdonald', 'pizza', 'sushi', 'diner', 'deli'] },
  { label: 'Coffee', keys: ['coffee', 'starbucks', 'espresso', 'latte', 'cafe', 'dunkin'] },
  { label: 'Fuel', keys: ['gas', 'fuel', 'shell', 'chevron', 'petrol', 'exxon', 'gasoline', 'mobil', 'arco'] },
  { label: 'Transport', keys: ['uber', 'lyft', 'taxi', 'transit', 'metro', 'subway pass', 'bus', 'train', 'parking', 'toll', 'car payment', 'registration', 'dmv'] },
  { label: 'Car & Repairs', keys: ['mechanic', 'oil change', 'tires', 'car repair', 'auto repair', 'car wash', 'body shop'] },
  { label: 'Insurance', keys: ['insurance', 'geico', 'allstate', 'progressive', 'state farm', 'premium'] },
  { label: 'Health', keys: ['doctor', 'dentist', 'pharmacy', 'medical', 'health', 'therapy', 'clinic', 'prescription', 'cvs', 'walgreens', 'hospital', 'copay', 'urgent care', 'optometrist'] },
  { label: 'Fitness', keys: ['gym', 'fitness', 'yoga', 'peloton', 'crossfit', 'personal trainer', 'pilates'] },
  { label: 'Subscriptions', keys: ['netflix', 'spotify', 'hulu', 'disney', 'apple music', 'icloud', 'dropbox', 'notion', 'figma', 'adobe', 'chatgpt', 'subscription', 'membership', 'prime', 'patreon', 'substack', 'paramount'] },
  { label: 'Software & Tools', keys: ['software', 'saas', 'hosting', 'domain', 'aws', 'vercel', 'github', 'server', 'api', 'license'] },
  { label: 'Shopping', keys: ['amazon', 'target', 'clothes', 'clothing', 'shoes', 'nike', 'zara', 'uniqlo', 'apparel', 'shopping', 'furniture', 'ikea', 'wayfair'] },
  { label: 'Home & Repairs', keys: ['home depot', 'lowes', 'hardware', 'plumber', 'electrician', 'handyman', 'renovation', 'furnace', 'appliance', 'lawn', 'landscaping', 'house cleaning'] },
  { label: 'Entertainment', keys: ['movie', 'cinema', 'concert', 'game', 'games', 'steam', 'playstation', 'xbox', 'nintendo', 'tickets', 'bar', 'drinks', 'museum', 'festival'] },
  { label: 'Travel', keys: ['flight', 'airline', 'hotel', 'airbnb', 'booking', 'vacation', 'trip', 'expedia', 'delta', 'rental car', 'baggage', 'resort'] },
  { label: 'Childcare & Family', keys: ['daycare', 'childcare', 'babysitter', 'nanny', 'school supplies', 'diapers', 'formula'] },
  { label: 'Education', keys: ['course', 'tuition', 'textbook', 'udemy', 'coursera', 'class', 'workshop', 'certification', 'student fees'] },
  { label: 'Pets', keys: ['pet', 'vet', 'veterinary', 'petco', 'petsmart', 'grooming', 'dog food', 'cat food'] },
  { label: 'Personal Care', keys: ['haircut', 'salon', 'barber', 'nails', 'spa', 'skincare', 'cosmetics'] },
  { label: 'Professional Services', keys: ['legal', 'lawyer', 'attorney', 'accountant', 'cpa', 'bookkeeping', 'notary', 'filing fee'] },
  { label: 'Taxes', keys: ['tax payment', 'irs', 'quarterly tax', 'estimated tax', 'self employment tax', 'sales tax'] },
  { label: 'Business Expenses', keys: ['equipment', 'supplies', 'materials', 'tools', 'inventory', 'shipping', 'postage', 'printing', 'advertising', 'ad spend', 'marketing', 'office'] },
  { label: 'Debt', keys: ['loan', 'student loan', 'credit card payment', 'debt', 'repayment', 'minimum payment'] },
  { label: 'Savings & Transfers', keys: ['savings', 'transfer', 'invest', 'roth', '401k', 'deposit', 'emergency fund'] },
  { label: 'Charity & Gifts', keys: ['charity', 'donation', 'tithe', 'gift', 'fundraiser'] },
  { label: 'Fees', keys: ['bank fee', 'atm fee', 'overdraft', 'service fee', 'late fee', 'wire fee', 'processing fee'] },
]

function lexiconMatch(normalized: string, kind: TxKind): string | null {
  if (!normalized) return null
  const padded = ` ${normalized} `
  let best: { label: string; weight: number } | null = null

  for (const entry of LEXICON) {
    if (entry.kind && entry.kind !== kind) continue
    for (const key of entry.keys) {
      // Tolerate a plural on the final word: "Trader Joes" and "Trader Joe's"
      // both have to land in the same place as "trader joe".
      if (
        padded.includes(` ${key} `) ||
        padded.includes(` ${key}s `) ||
        padded.includes(` ${key}es `) ||
        normalized === key
      ) {
        // Longer keys are more specific: "credit card payment" beats "card".
        const weight = key.length
        if (!best || weight > best.weight) best = { label: entry.label, weight }
      }
    }
  }
  return best?.label ?? null
}

/* ── Similarity ───────────────────────────────────────── */

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let shared = 0
  setA.forEach((t) => {
    if (setB.has(t)) shared++
  })
  return shared / (setA.size + setB.size - shared)
}

/** Sørensen–Dice over character bigrams — forgiving of typos and plurals. */
function dice(a: string, b: string): number {
  const bigrams = (s: string) => {
    const out: string[] = []
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2))
    return out
  }
  const A = bigrams(a)
  const B = bigrams(b)
  if (!A.length || !B.length) return a === b ? 1 : 0
  const pool = new Map<string, number>()
  A.forEach((g) => pool.set(g, (pool.get(g) ?? 0) + 1))
  let hits = 0
  B.forEach((g) => {
    const n = pool.get(g) ?? 0
    if (n > 0) {
      pool.set(g, n - 1)
      hits++
    }
  })
  return (2 * hits) / (A.length + B.length)
}

export function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (!a || !b) return 0

  const ta = tokens(a)
  const tb = tokens(b)

  // Containment: "adsense" vs "youtube adsense payout" is the same thing.
  const short = ta.length <= tb.length ? ta : tb
  const long = ta.length <= tb.length ? tb : ta
  const contained = short.every((t) => long.includes(t))
  if (contained && short.length > 0) return 0.95

  return Math.max(jaccard(ta, tb), dice(a, b) * 0.92)
}

const THRESHOLD = 0.58

/* ── Grouping ─────────────────────────────────────────── */

export interface Group {
  /** Identity, derived from the label so it survives amount changes. */
  key: string
  label: string
  total: number
  count: number
  share: number
  /** When this group first appeared — used to give it a stable colour. */
  firstSeen: number
  transactions: Transaction[]
}

interface Bucket {
  key: string
  /** Normalised seed used for comparisons. */
  seed: string
  label: string | null
  /** Set when the user named this bucket; only overrides may join it. */
  pinned: boolean
  titleCounts: Map<string, number>
  items: Transaction[]
}

export function groupTransactions(list: Transaction[]): Group[] {
  const buckets: Bucket[] = []

  // Most frequent titles first, so the dominant spelling seeds the bucket.
  const freq = new Map<string, number>()
  list.forEach((t) => {
    const n = normalize(t.title)
    freq.set(n, (freq.get(n) ?? 0) + 1)
  })
  const ordered = list
    .slice()
    .sort(
      (a, b) =>
        (freq.get(normalize(b.title)) ?? 0) -
          (freq.get(normalize(a.title)) ?? 0) ||
        a.createdAt - b.createdAt,
    )

  for (const tx of ordered) {
    const norm = normalize(tx.title)
    const override = tx.group?.trim()
    const lex = override ? null : lexiconMatch(norm, tx.kind)

    let target: Bucket | undefined

    if (override) {
      // You said where this belongs. Nothing else gets a vote.
      target = buckets.find((b) => b.pinned && b.label === override)
      if (!target) {
        target = {
          key: `pin:${override.toLowerCase()}`,
          seed: norm,
          label: override,
          pinned: true,
          titleCounts: new Map(),
          items: [],
        }
        buckets.push(target)
      }
    } else if (lex) {
      target = buckets.find((b) => !b.pinned && b.label === lex)
      if (!target) {
        target = {
          key: `lex:${lex}`,
          seed: norm,
          label: lex,
          pinned: false,
          titleCounts: new Map(),
          items: [],
        }
        buckets.push(target)
      }
    } else {
      let bestScore = 0
      for (const b of buckets) {
        if (b.label) continue // named buckets only accept named hits
        const score = similarity(norm, b.seed)
        if (score > bestScore) {
          bestScore = score
          target = b
        }
      }
      if (!target || bestScore < THRESHOLD) {
        target = {
          key: `fuzzy:${norm || tx.title.toLowerCase()}:${buckets.length}`,
          seed: norm,
          label: null,
          pinned: false,
          titleCounts: new Map(),
          items: [],
        }
        buckets.push(target)
      }
    }

    target.items.push(tx)
    const raw = tx.title.trim()
    target.titleCounts.set(raw, (target.titleCounts.get(raw) ?? 0) + 1)
  }

  const grand = list.reduce((sum, t) => sum + t.amount, 0)

  return buckets
    .map((b) => {
      const total = b.items.reduce((sum, t) => sum + t.amount, 0)
      const label = b.label ?? bestLabel(b.titleCounts)
      return {
        key: label.toLowerCase(),
        label,
        total,
        count: b.items.length,
        share: grand > 0 ? total / grand : 0,
        firstSeen: b.items.reduce((min, t) => Math.min(min, t.createdAt), Infinity),
        transactions: b.items
          .slice()
          .sort((a, c) => c.date.localeCompare(a.date) || c.createdAt - a.createdAt),
      }
    })
    .sort((a, b) => b.total - a.total)
}

/**
 * Where a single entry would land, given the others of its kind. Used to show
 * the destination before you commit — and to offer it as the thing to correct.
 */
export function detectGroup(tx: Transaction, pool: Transaction[]): string {
  const siblings = pool.filter((t) => t.id !== tx.id && t.kind === tx.kind)
  const groups = groupTransactions([...siblings, tx])
  return (
    groups.find((g) => g.transactions.some((t) => t.id === tx.id))?.label ??
    titleCase(tx.title.trim() || 'Untitled')
  )
}

/** The most-used spelling wins; ties go to the shortest, then tidied up. */
function bestLabel(counts: Map<string, number>): string {
  let best = ''
  let bestN = -1
  counts.forEach((n, title) => {
    if (n > bestN || (n === bestN && title.length < best.length)) {
      best = title
      bestN = n
    }
  })
  return titleCase(best || 'Untitled')
}

function titleCase(s: string): string {
  // Respect deliberate casing (AdSense, iPhone) — only fix all-lowercase input.
  if (/[A-Z]/.test(s)) return s
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase())
}
