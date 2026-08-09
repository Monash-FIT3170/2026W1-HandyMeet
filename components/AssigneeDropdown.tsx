'use client';

import { useEffect, useRef, useState } from 'react';
import type { ParticipantOption } from '@/hooks/useMeetingParticipants';

type AssigneeDropdownProps = {
  participants: ParticipantOption[];
  assigneeId: string | null;
  onAssign: (id: string | null) => void;
  disabled?: boolean;
};

export default function AssigneeDropdown({
  participants,
  assigneeId,
  onAssign,
  disabled = false,
}: AssigneeDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = participants.find((p) => p.id === assigneeId);

  function handleSelect(id: string | null) {
    onAssign(id);
    setOpen(false);
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.7rem',
          borderRadius: '999px',
          border: '1px solid rgba(255,255,255,0.12)',
          background: selected
            ? 'rgba(16,89,154,0.18)'
            : 'rgba(255,255,255,0.05)',
          color: selected ? '#9FC6EA' : 'rgba(255,255,255,0.6)',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {selected ? selected.name : 'Unassigned'}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.35rem)',
            left: 0,
            minWidth: '160px',
            maxHeight: '200px',
            overflowY: 'auto',
            background: '#1a1a1e',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px',
            padding: '0.25rem',
            listStyle: 'none',
            margin: 0,
            zIndex: 20,
          }}
        >
          <li
            role="option"
            aria-selected={assigneeId === null}
            onClick={() => handleSelect(null)}
            style={{
              padding: '0.4rem 0.6rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
            }}
          >
            Unassigned
          </li>
          {participants.map((p) => (
            <li
              key={p.id}
              role="option"
              aria-selected={p.id === assigneeId}
              onClick={() => handleSelect(p.id)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                color:
                  p.id === assigneeId ? '#9FC6EA' : 'rgba(255,255,255,0.85)',
                background:
                  p.id === assigneeId ? 'rgba(16,89,154,0.18)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {p.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
