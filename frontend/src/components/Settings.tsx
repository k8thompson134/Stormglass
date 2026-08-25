import { useEffect, useRef } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import type { HealthToggles } from "../types/health";
import type { AqiSensitivity } from "../utils/aqiCategory";
import LocationSettings from "./settings/LocationSettings";
import HealthConditionSettings from "./settings/HealthConditionSettings";
import AqiSensitivitySettings from "./settings/AqiSensitivitySettings";
import NotificationSettings from "./settings/NotificationSettings";
import ApiTokenPanel from "./settings/ApiTokenPanel";
import FeedbackLink from "./settings/FeedbackLink";

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  onLocationChanged: () => void;
  healthToggles: HealthToggles;
  onHealthTogglesChange: (toggles: HealthToggles) => void;
  aqiSensitivity: AqiSensitivity;
  onAqiSensitivityChange: (sensitivity: AqiSensitivity) => void;
}

export default function Settings({
  open,
  onClose,
  onLocationChanged,
  healthToggles,
  onHealthTogglesChange,
  aqiSensitivity,
  onAqiSensitivityChange,
}: SettingsProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, modalRef, { onEscape: onClose });

  // Close on click outside or Escape key
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 sm:py-10">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        className="relative w-full max-w-lg mx-4 bg-[#131d2e] border border-[#1e2d45] rounded-2xl shadow-2xl outline-none max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e2d45]">
          <h2 className="text-white text-sm font-bold uppercase tracking-wider">
            Settings
          </h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="text-gray-300 hover:text-white transition-colors text-lg leading-none w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <LocationSettings open={open} onLocationChanged={onLocationChanged} />

          <HealthConditionSettings
            healthToggles={healthToggles}
            onHealthTogglesChange={onHealthTogglesChange}
          />

          <AqiSensitivitySettings
            healthToggles={healthToggles}
            onHealthTogglesChange={onHealthTogglesChange}
            aqiSensitivity={aqiSensitivity}
            onAqiSensitivityChange={onAqiSensitivityChange}
          />

          <NotificationSettings open={open} />

          <ApiTokenPanel />

          <FeedbackLink />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1e2d45] flex justify-end">
          <button
            onClick={onClose}
            className="text-xs text-gray-300 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
