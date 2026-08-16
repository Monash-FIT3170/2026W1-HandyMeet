import type { LiveActionItem } from '@/hooks/useLiveActionItems';
import { ParticipantOption } from '@/hooks/useMeetingParticipants';
import AssigneeDropdown from '../AssigneeDropdown';
import { useState } from 'react';

export type ActionItemActionHandlers = {
  onAccept?: (itemId: string) => void;
  onEdit?: (itemId: string, newTask: string) => void;
  onDismiss?: (itemId: string) => void;
  onAssign?: (itemID: string, assigneeID: string | null) => void;
};

type ActionItemCardProps = ActionItemActionHandlers & {
  item: LiveActionItem;
  participants?: ParticipantOption[];
};

export default function ActionItemCard({
  item,
  participants = [],
  onAccept,
  onEdit,
  onDismiss,
  onAssign,
}: ActionItemCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTask, setDraftTask] = useState(item.task);

  function commitEdit() {
    const trimmed = draftTask.trim();
    if (trimmed && trimmed !== item.task) {
      onEdit?.(item.id, trimmed);
    } else {
      setDraftTask(item.task); // reset if empty or unchanged
    }
    setIsEditing(false);
  }

  function cancelEdit() {
    setDraftTask(item.task);
    setIsEditing(false);
  }

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
        {isEditing ? (
          <input
            type="text"
            value={draftTask}
            autoFocus
            onChange={(e) => setDraftTask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            onBlur={commitEdit}
            className="text-neutral-100 text-sm leading-5 w-full bg-white/10 border border-primary-500/40 rounded-md px-2 py-1 outline-none focus:border-primary-400"
          />
        ) : (
          <p
            className="text-neutral-100 text-sm leading-5 cursor-text"
            onClick={() => onEdit && setIsEditing(true)}
          >
            {item.task}
          </p>
        )}
      </div>

      {item.dueDate && (
        <p className="text-neutral-400 text-xs">
          Due <time dateTime={item.dueDate}>{item.dueDate}</time>
        </p>
      )}

      {onAssign && (
        <div>
          <p className="text-neutral-400 text-[0.625rem] font-bold uppercase mb-1">
            Assign to
          </p>
          <AssigneeDropdown
            participants={participants}
            assigneeId={item.assigneeId}
            onAssign={(assigneeId) => onAssign(item.id, assigneeId)}
          />
        </div>
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
            onClick={() => setIsEditing(true)}
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
