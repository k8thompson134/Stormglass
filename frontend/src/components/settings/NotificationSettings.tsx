import { useState, useEffect } from "react";
import {
  isPushSupported,
  isPushEnabled,
  enablePushNotifications,
  disablePushNotifications,
  getSecondaryAlertEnabled,
  toggleSecondaryAlert,
  getNotificationLog,
  reconcilePushSubscription,
  SECONDARY_ALERT_KINDS,
  type PushEnableResult,
} from "../../utils/pushNotifications";
import type {
  PushNotificationLogEntry,
  SecondaryAlertKind,
} from "../../services/api";

// Config-driven so adding a new condition-specific alert is one array entry, not a
// new copy of the toggle JSX block below.
const SECONDARY_ALERT_CONFIG: { kind: SecondaryAlertKind; label: string }[] = [
  {
    kind: "migraine",
    label:
      "Migraine risk alerts (push notification when risk is high or severe)",
  },
  {
    kind: "mecfs",
    label:
      "ME/CFS crash risk alerts (push notification when pressure volatility signals crash risk)",
  },
  {
    kind: "pots",
    label:
      "POTS risk alerts (push notification when heat/cold/pressure conditions stack up)",
  },
  {
    kind: "clear-air",
    label:
      "Clean air window alerts (push notification when a clear stretch is coming up)",
  },
  {
    kind: "sinus",
    label:
      "Sinus risk alerts (push notification when pressure/humidity/pollen stack up)",
  },
  {
    kind: "cluster",
    label:
      "Cluster headache risk alerts (push notification on a fast pressure drop)",
  },
  {
    kind: "fibromyalgia",
    label:
      "Fibromyalgia risk alerts (push notification when cold/damp/pressure stack up)",
  },
];

const DEFAULT_SECONDARY_ALERTS: Record<SecondaryAlertKind, boolean> = {
  migraine: false,
  mecfs: false,
  pots: false,
  "clear-air": false,
  sinus: false,
  cluster: false,
  fibromyalgia: false,
};

const DEFAULT_SECONDARY_ALERT_ERRORS: Record<
  SecondaryAlertKind,
  string | null
> = {
  migraine: null,
  mecfs: null,
  pots: null,
  "clear-air": null,
  sinus: null,
  cluster: null,
  fibromyalgia: null,
};

interface Props {
  open: boolean;
}

export default function NotificationSettings({ open }: Props) {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushSuccess, setPushSuccess] = useState<string | null>(null);
  const [secondaryAlerts, setSecondaryAlerts] = useState<
    Record<SecondaryAlertKind, boolean>
  >(DEFAULT_SECONDARY_ALERTS);
  const [secondaryAlertsBusy, setSecondaryAlertsBusy] = useState<
    Record<SecondaryAlertKind, boolean>
  >(DEFAULT_SECONDARY_ALERTS);
  const [secondaryAlertError, setSecondaryAlertError] = useState<
    Record<SecondaryAlertKind, string | null>
  >(DEFAULT_SECONDARY_ALERT_ERRORS);
  const [logOpen, setLogOpen] = useState(false);
  const [logEntries, setLogEntries] = useState<
    PushNotificationLogEntry[] | null
  >(null);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState(false);

  // Reflect actual subscription state (not just "did the user check the box last
  // time") -- permission can be revoked from browser settings without this app
  // knowing, so check the real PushManager subscription each time the modal opens.
  useEffect(() => {
    if (!open) return;
    // Try to repair a silently-dropped subscription before reading state, so
    // opening Settings shows "on" (and actually restores the subscription)
    // rather than surfacing a drop the user would otherwise have to notice and
    // fix by hand.
    reconcilePushSubscription().finally(() => {
      isPushEnabled().then((enabled) => {
        setPushEnabled(enabled);
        if (enabled) {
          SECONDARY_ALERT_KINDS.forEach((kind) => {
            // Without this .catch, a failed fetch (e.g. the backend subscription
            // row was deleted independently of the browser's) becomes an unhandled
            // promise rejection and leaves secondaryAlerts[kind] stuck at its prior
            // value -- silently wrong rather than visibly failed.
            getSecondaryAlertEnabled(kind)
              .then((value) =>
                setSecondaryAlerts((prev) => ({ ...prev, [kind]: value })),
              )
              .catch(() =>
                setSecondaryAlertError((prev) => ({
                  ...prev,
                  [kind]:
                    "Couldn't load current setting — try reopening Settings",
                })),
              );
          });
        }
      });
    });
  }, [open]);

  // Reset so reopening the modal later fetches fresh, rather than showing a stale
  // log (or a stale error) from earlier in the session.
  useEffect(() => {
    if (!open) {
      setLogOpen(false);
      setLogEntries(null);
      setLogError(false);
    }
  }, [open]);

  const handleToggleSecondaryAlert = async (kind: SecondaryAlertKind) => {
    setSecondaryAlertsBusy((prev) => ({ ...prev, [kind]: true }));
    setSecondaryAlertError((prev) => ({ ...prev, [kind]: null }));
    try {
      const next = !secondaryAlerts[kind];
      const ok = await toggleSecondaryAlert(kind, next);
      if (ok) {
        setSecondaryAlerts((prev) => ({ ...prev, [kind]: next }));
      } else {
        setSecondaryAlertError((prev) => ({
          ...prev,
          [kind]: "Push isn't active on this device — try re-enabling it above",
        }));
      }
    } catch {
      // toggleSecondaryAlert throws if the backend call fails (e.g. the
      // subscription row was deleted server-side) -- without catching this, the
      // checkbox silently stays at its old value with zero indication the toggle
      // didn't take effect.
      setSecondaryAlertError((prev) => ({
        ...prev,
        [kind]: "Couldn't update this setting — try again",
      }));
    } finally {
      setSecondaryAlertsBusy((prev) => ({ ...prev, [kind]: false }));
    }
  };

  const toggleLog = async () => {
    const next = !logOpen;
    setLogOpen(next);
    if (next && logEntries === null) {
      setLogLoading(true);
      setLogError(false);
      try {
        setLogEntries(await getNotificationLog());
      } catch {
        // Distinct from "no alerts yet" (an empty array) -- a failed fetch (e.g.
        // a stale client-side push subscription the server already deleted)
        // must say so rather than rendering nothing, indistinguishable from
        // "hasn't loaded" or "button not clicked."
        setLogError(true);
      } finally {
        setLogLoading(false);
      }
    }
  };

  const outcomeLabel: Record<
    PushNotificationLogEntry["outcome"],
    { text: string; className: string }
  > = {
    sent: { text: "Delivered", className: "text-emerald-300" },
    suppressed_dedup: {
      text: "Skipped (already notified)",
      className: "text-gray-500",
    },
    delivery_failed: { text: "Delivery failed", className: "text-amber-300" },
  };

  const typeLabel: Record<PushNotificationLogEntry["type"], string> = {
    aqi: "Air quality (forecast)",
    aqi_current: "Air quality (right now)",
    migraine: "Migraine risk",
    mecfs: "ME/CFS crash risk",
    pots: "POTS risk",
    sinus: "Sinus risk",
    cluster: "Cluster headache risk",
    fibromyalgia: "Fibromyalgia risk",
    clear_air: "Clean air window",
    welcome: "Setup confirmation",
  };

  const togglePush = async () => {
    setPushBusy(true);
    setPushError(null);
    setPushSuccess(null);
    try {
      if (pushEnabled) {
        await disablePushNotifications();
        setPushEnabled(false);
        // Disabling tears down the browser subscription entirely, so a later
        // re-enable always creates a brand new one (fresh backend row, every
        // secondary alert defaulting off) -- reset here so stale "on" checkboxes
        // from before disabling can't linger and desync from that backend truth.
        setSecondaryAlerts(DEFAULT_SECONDARY_ALERTS);
        setSecondaryAlertError(DEFAULT_SECONDARY_ALERT_ERRORS);
      } else {
        const result: PushEnableResult = await enablePushNotifications();
        if (result.ok) {
          setPushEnabled(true);
          // Mirror the fresh subscription's actual backend defaults (every
          // secondary alert off) rather than leaving whatever secondaryAlerts held
          // from a previous enable/disable cycle earlier in this same modal
          // session -- without this, a checkbox can show "on" when the newly
          // created subscription is actually not opted into that alert at all.
          setSecondaryAlerts(DEFAULT_SECONDARY_ALERTS);
          // In-app confirmation shows immediately regardless of OS-level delivery
          // (Do Not Disturb, notification-style settings, etc. are outside our
          // control) -- the confirmation push itself is sent a few seconds later
          // (see push.ts's WELCOME_PUSH_DELAY_MS) to give the fresh subscription
          // time to settle with the push service, so it's a bonus real-world
          // confirmation, not the only one, and not synchronous with this message.
          setPushSuccess(
            "You're all set up! A confirmation notification should arrive in a few seconds.",
          );
        } else {
          const messages: Record<
            Exclude<PushEnableResult, { ok: true }>["reason"],
            string
          > = {
            unsupported: "This browser doesn't support push notifications.",
            "not-configured":
              "Push notifications aren't set up on this server yet.",
            "permission-denied":
              "Notification permission was denied — check your browser's site settings.",
            error: "Something went wrong enabling notifications. Try again.",
          };
          setPushError(messages[result.reason]);
        }
      }
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="border-t border-[#1e2d45] pt-5">
      <label className="text-[10px] text-gray-300 font-bold uppercase tracking-wider block mb-2">
        Notifications
      </label>
      {isPushSupported() ? (
        <>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-200 ${
                pushEnabled
                  ? "border-blue-500/50 bg-blue-500/20 text-blue-300"
                  : "border-[#1e2d45] bg-[#131d2e]"
              }`}
              aria-hidden
            >
              {pushEnabled && (
                <svg
                  className="h-2.5 w-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </span>
            <input
              type="checkbox"
              className="sr-only"
              checked={pushEnabled}
              disabled={pushBusy}
              onChange={togglePush}
            />
            <span className="text-[11px] text-gray-300">
              {pushBusy
                ? "Updating…"
                : "Air quality alerts (push notification when AQI worsens)"}
            </span>
          </label>
          {pushSuccess && (
            <p className="text-[11px] text-emerald-300 mt-2 flex items-start gap-1.5">
              <span>✓</span>
              <span>{pushSuccess}</span>
            </p>
          )}
          {pushError && (
            <p className="text-[11px] text-amber-300 mt-2">{pushError}</p>
          )}
          {pushEnabled &&
            SECONDARY_ALERT_CONFIG.map(({ kind, label }) => (
              <div key={kind} className="mt-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-200 ${
                      secondaryAlerts[kind]
                        ? "border-blue-500/50 bg-blue-500/20 text-blue-300"
                        : "border-[#1e2d45] bg-[#131d2e]"
                    }`}
                    aria-hidden
                  >
                    {secondaryAlerts[kind] && (
                      <svg
                        className="h-2.5 w-2.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={secondaryAlerts[kind]}
                    disabled={secondaryAlertsBusy[kind]}
                    onChange={() => handleToggleSecondaryAlert(kind)}
                  />
                  <span className="text-[11px] text-gray-300">
                    {secondaryAlertsBusy[kind] ? "Updating…" : label}
                  </span>
                </label>
                {secondaryAlertError[kind] && (
                  <p className="text-[11px] text-amber-300 mt-1 ml-7">
                    {secondaryAlertError[kind]}
                  </p>
                )}
              </div>
            ))}
          {pushEnabled && (
            <div className="mt-3">
              <button
                type="button"
                onClick={toggleLog}
                className="text-[11px] text-blue-300 hover:text-blue-200 underline underline-offset-2"
              >
                {logOpen
                  ? "Hide notification history"
                  : "View notification history"}
              </button>
              {logOpen && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded border border-[#1e2d45] bg-[#0e1725] p-2 space-y-2">
                  {logLoading && (
                    <p className="text-[11px] text-gray-500">Loading…</p>
                  )}
                  {!logLoading && logError && (
                    <p className="text-[11px] text-amber-300">
                      Couldn't load notification history — try again.
                    </p>
                  )}
                  {!logLoading &&
                    !logError &&
                    logEntries !== null &&
                    logEntries.length === 0 && (
                      <p className="text-[11px] text-gray-500">
                        No alerts have been triggered yet.
                      </p>
                    )}
                  {!logLoading &&
                    !logError &&
                    logEntries?.map((entry, i) => (
                      <div
                        key={i}
                        className="text-[11px] border-b border-[#1e2d45] last:border-0 pb-2 last:pb-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-300">
                            {typeLabel[entry.type]}
                          </span>
                          <span
                            className={outcomeLabel[entry.outcome].className}
                          >
                            {outcomeLabel[entry.outcome].text}
                          </span>
                        </div>
                        <p className="text-gray-500">
                          {new Date(entry.createdAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                          {entry.eventAt && (
                            <>
                              {" "}
                              · for{" "}
                              {new Date(entry.eventAt).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </>
                          )}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-[11px] text-gray-500">
          Push notifications aren't supported in this browser.
        </p>
      )}
    </div>
  );
}
