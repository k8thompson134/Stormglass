import { useRef } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { createPortal } from "react-dom";
import Insights from "./Insights";
import type { CurrentWeather } from "../services/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenSymptomLogger: () => void;
  current: CurrentWeather | null;
}

export default function TrendsModal({
  open,
  onClose,
  onOpenSymptomLogger,
  current,
}: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, modalRef, { onEscape: onClose });

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Symptom Trends"
        tabIndex={-1}
        className="bg-gray-900/95 border border-gray-700/50 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-700/50 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-white text-sm font-bold uppercase tracking-wider">
              Symptom Trends
            </h2>
            <p className="text-[11px] text-gray-400 mt-2">
              Correlations between environmental factors and your symptoms
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center hover:bg-gray-800/50 rounded-lg shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <Insights
            onOpenSymptomLogger={onOpenSymptomLogger}
            current={current}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
