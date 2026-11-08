import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Professional mobile-first modal / bottom-sheet.
 * - Mobile: slides up from bottom (bottom sheet)
 * - Desktop: centered card
 * Replaces browser alert/confirm and crude overlays.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md', // sm | md | lg
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const maxW = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-lg' : 'max-w-md';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet / card */}
      <div
        className={`
          relative w-full ${maxW} bg-white
          rounded-t-3xl md:rounded-3xl
          shadow-2xl
          max-h-[88vh] md:max-h-[85vh]
          flex flex-col
          animate-sheet-up md:animate-scale-in
        `}
      >
        {/* Handle (mobile) */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        {(title || onClose) && (
          <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-border shrink-0">
            <h3 className="font-semibold text-charcoal text-lg">{title}</h3>
            {onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-ivory flex items-center justify-center text-muted active:bg-border"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-4 border-t border-border shrink-0 bg-ivory/40">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Confirm dialog built on Modal */
export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border font-medium text-charcoal active:bg-ivory"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-white ${
              danger ? 'bg-red-600 active:bg-red-700' : 'bg-emerald active:bg-emerald-dark'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm text-muted leading-relaxed">{message}</p>
    </Modal>
  );
}
