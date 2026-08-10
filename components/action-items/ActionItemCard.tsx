import type { LiveActionItem } from '@/hooks/useLiveActionItems';

export type ActionItemActionHandlers = {
  onAccept?: (itemId: string) => void;
  onEdit?: (itemId: string) => void;
  onDismiss?: (itemId: string) => void;
};

type ActionItemCardProps = ActionItemActionHandlers & {
  item: LiveActionItem;
};

export default function ActionItemCard({
  item,
  onAccept,
  onEdit,
  onDismiss,
}: ActionItemCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <div>
        <p className="text-neutral-400 text-[0.625rem] font-bold uppercase">
          Who
        </p>
        <p className="text-primary-200 text-sm font-semibold">
          {item.owner ?? 'Unassigned'}
        </p>
      </div>

      <div>
        <p className="text-neutral-400 text-[0.625rem] font-bold uppercase">
          Task
        </p>
        <p className="text-neutral-100 text-sm leading-5">{item.task}</p>
      </div>

      {item.dueDate && (
        <p className="text-neutral-400 text-xs">
          Due <time dateTime={item.dueDate}>{item.dueDate}</time>
        </p>
      )}

      {item.status === 'suggested' && (
        <div className="flex items-center gap-2 border-t border-white/10 pt-3">
          <button
            type="button"
            className="bg-primary-500/20 text-primary-200 hover:bg-primary-500/30 flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold"
            onClick={() => onAccept?.(item.id)}
          >
            Accept
          </button>
          <button
            type="button"
            className="text-neutral-300 hover:text-neutral-100 cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-semibold hover:bg-white/10"
            onClick={() => onEdit?.(item.id)}
          >
            Edit
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-lg border border-red-300/15 bg-red-400/5 px-2 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-400/10"
            onClick={() => onDismiss?.(item.id)}
          >
            Dismiss
          </button>
        </div>
      )}
    </article>
  );
}
