import type { Announcement } from '../types'

const CATEGORY_COLORS: Record<string, string> = {
  Academic: 'bg-sky text-ink',
  Event: 'bg-blush text-ink',
  Exam: 'bg-butter text-ink',
  Holiday: 'bg-sage text-ink',
  Urgent: 'bg-ink text-cream-soft',
}

const CATEGORY_CARD_TINT: Record<string, string> = {
  Academic: 'tint-sky',
  Event: 'tint-blush',
  Exam: 'tint-butter',
  Holiday: 'tint-sage',
  Urgent: 'tint-blush',
}

export function isAnnouncementLive(a: Announcement): boolean {
  if (!a.isActive) return false
  if (a.expiresAt && a.expiresAt < Date.now()) return false
  return true
}

export function AnnouncementCard({
  a,
  actions,
}: {
  a: Announcement
  actions?: React.ReactNode
}) {
  return (
    <div className={`card-tint ${CATEGORY_CARD_TINT[a.category] ?? 'tint-sky'} ${a.isUrgent ? 'ring-2 ring-ink' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-ink">{a.title}</h3>
            <span className={`badge border-ink ${CATEGORY_COLORS[a.category]}`}>{a.category}</span>
            {a.isUrgent && <span className="badge bg-ink text-cream-soft border-ink">URGENT</span>}
          </div>
          <p className="text-sm mt-1 text-ink/80">{a.message}</p>
          <p className="text-xs mt-2 text-ink/60">
            {a.authorName} · {new Date(a.createdAt).toLocaleDateString()}
            {a.expiresAt ? ` · expires ${new Date(a.expiresAt).toLocaleDateString()}` : ''}
          </p>
        </div>
        {actions}
      </div>
    </div>
  )
}

export function AnnouncementList({
  items,
  actionsFor,
}: {
  items: Announcement[]
  actionsFor?: (a: Announcement) => React.ReactNode
}) {
  if (items.length === 0) return <p className="text-sm text-ink-muted">No announcements yet.</p>
  return (
    <div className="space-y-3">
      {items.map((a) => (
        <AnnouncementCard key={a.id} a={a} actions={actionsFor?.(a)} />
      ))}
    </div>
  )
}