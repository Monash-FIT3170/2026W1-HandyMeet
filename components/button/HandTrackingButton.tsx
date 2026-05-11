import { useState } from 'react';

type HandTrackingButtonProps = {
  trackingEnabled: boolean;
  overlayEnabled: boolean;
  isTracking: boolean;
  isCameraEnabled: boolean;
  onToggleTracking: () => void;
  onToggleOverlay: () => void;
};

export default function HandTrackingButton({
  trackingEnabled,
  overlayEnabled,
  isTracking,
  isCameraEnabled,
  onToggleTracking,
  onToggleOverlay,
}: HandTrackingButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button className="lk-button" onClick={() => setOpen((prev) => !prev)}>
        Gestures
      </button>
      {open && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 
                        bg-neutral-900 border border-neutral-700 rounded-lg 
                        p-3 flex flex-col gap-2 w-44"
        >
          <button
            onClick={onToggleTracking}
            className="hover:text-emerald-400 transition-colors disabled:opacity-40"
            disabled={!isCameraEnabled}
          >
            {trackingEnabled ? 'Tracking On' : 'Tracking Off'}
          </button>
          <button
            onClick={onToggleOverlay}
            disabled={!trackingEnabled || !isCameraEnabled}
            className="hover:text-emerald-400 transition-colors disabled:opacity-40"
          >
            {overlayEnabled ? 'Overlay On' : 'Overlay Off'}
          </button>
          {trackingEnabled && (
            <p className="text-center bg-green-950 rounded-2xl">
              {isTracking ? 'Hand detected' : 'No hand detected'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
