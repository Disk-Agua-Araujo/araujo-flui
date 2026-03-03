// Lightweight analytics hook — logs to console and pushes to dataLayer if present.
export type EventName =
  | "whatsapp_click"
  | "whatsapp_opened"
  | "call_click"
  | "order_submit"
  | "order_created"
  | "lead_submit"
  | "label_printed";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function trackEvent(event: string, data?: Record<string, unknown>) {
  const payload = { event, ...data, timestamp: new Date().toISOString() };
  console.log("[analytics]", payload);
  if (typeof window !== "undefined" && Array.isArray(window.dataLayer)) {
    window.dataLayer.push(payload);
  }
}
