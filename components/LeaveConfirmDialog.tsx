'use client';

type LeaveConfirmDialogProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

export default function LeaveConfirmDialog({
  onConfirm,
  onCancel,
}: LeaveConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-neutral-800/50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 w-full max-w-sm rounded-xl shadow-xl overflow-hidden border border-neutral-800">
        <div className="px-6 py-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-neutral-100">
            Leave the call?
          </h2>
        </div>

        <div className="px-6 py-4 text-neutral-300">
          You&apos;ll be disconnected from the call. You can view the transcript
          and generate an AI summary afterwards.
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-800 px-6 py-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-[#DB4C77] hover:bg-[#c43e67] text-neutral-100 font-semibold"
          >
            Leave Call
          </button>
        </div>
      </div>
    </div>
  );
}
