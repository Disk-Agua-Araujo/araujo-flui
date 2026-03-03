// Lightweight analytics hook — logs to console and pushes to dataLayer if present.
type EventName = "whatsapp_click" | "call_click" | "order_submit" | "lead_submit";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function trackEvent(event: EventName, data?: Record<string, unknown>) {
  const payload = { event, ...data, timestamp: new Date().toISOString() };
  console.log("[analytics]", payload);
  if (typeof window !== "undefined" && Array.isArray(window.dataLayer)) {
    window.dataLayer.push(payload);
  }
}
