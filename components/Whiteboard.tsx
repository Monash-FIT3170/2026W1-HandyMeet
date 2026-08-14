'use client';

import 'tldraw/tldraw.css';
import { DefaultStylePanel, Tldraw } from 'tldraw';

interface WhiteboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Whiteboard({ isOpen, onClose }: WhiteboardProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-0 z-50 bg-neutral-950 flex flex-col overflow-hidden">
      <div className="h-[45px] flex items-center justify-end px-4 bg-neutral-900 border-b border-neutral-800 shrink-0 select-none">
        <button
          onClick={onClose}
          className="text-xs px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>

      <div className="relative flex-1 w-full overflow-hidden">
        <div
          style={{
            height: '100%',
            width: '100%',
            position: 'absolute',
            inset: 0,
          }}
        >
          <Tldraw
            components={{
              StylePanel: () => (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    marginTop: 4,
                  }}
                >
                  <DefaultStylePanel />
                </div>
              ),
            }}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
