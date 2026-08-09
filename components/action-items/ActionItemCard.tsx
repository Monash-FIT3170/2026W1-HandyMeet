import type { LiveActionItem } from '@/hooks/useLiveActionItems';

type ActionItemCardProps = {
  item: LiveActionItem;
};

export default function ActionItemCard({ item }: ActionItemCardProps) {
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
    </article>
  );
}
