"use client";

export type ToastState = { id: number; message: string } | null;

// Always mounted so screen readers pick up each new message from the live region.
export function Toast({ toast, onView }: { toast: ToastState; onView: () => void }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      {toast && (
        <div
          key={toast.id}
          className="toast-in pointer-events-auto flex items-center gap-3 rounded-full border border-line-bar bg-panel px-4 py-2.5 text-sm text-fg shadow-lg"
        >
          <span>{toast.message}</span>
          <span aria-hidden className="text-fg-label">
            ·
          </span>
          <button type="button" onClick={onView} className="cursor-pointer border-0 bg-transparent p-0 text-sm font-medium text-accent hover:underline">
            View plan
          </button>
        </div>
      )}
    </div>
  );
}
