const OBSERVABILITY_VERSION = '1';

function getConfig() {
  const config = typeof globalThis !== 'undefined' && globalThis.LF_OBSERVABILITY;
  return config && typeof config === 'object' ? config : {};
}

function safeString(value, fallback = 'unknown') {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : fallback;
}

function now() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function traceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `lf-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function baseEvent(type, attributes = {}) {
  const config = getConfig();
  return {
    timeUnixNano: String(Date.now() * 1_000_000),
    traceId: config.traceId || traceId(),
    type: safeString(type),
    serviceName: safeString(config.serviceName, 'linguaflow-client'),
    serviceVersion: safeString(config.serviceVersion, OBSERVABILITY_VERSION),
    environment: safeString(config.environment, 'unknown'),
    route: typeof location !== 'undefined' ? location.pathname : 'worker',
    attributes: { ...attributes },
  };
}

async function exportEvent(event) {
  const config = getConfig();
  const endpoint = config.otlpEndpoint || config.eventsEndpoint;
  if (!endpoint || typeof fetch !== 'function') return;
  try {
    await fetch(endpoint, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json', ...(config.headers || {}) },
      body: JSON.stringify({ resource: { service: event.serviceName, version: event.serviceVersion }, events: [event] }),
    });
  } catch {
    // Telemetry must never break a learning flow.
  }
}

export function observe(type, attributes = {}) {
  const event = baseEvent(type, attributes);
  if (typeof globalThis !== 'undefined' && typeof globalThis.CustomEvent === 'function') {
    globalThis.dispatchEvent?.(new CustomEvent('lf_observability', { detail: event }));
  }
  void exportEvent(event);
  return event;
}

export function observeError(error, context = {}) {
  const normalized = error instanceof Error ? error : new Error(String(error || 'Unknown error'));
  return observe('exception', {
    ...context,
    errorType: safeString(normalized.name, 'Error'),
    message: safeString(normalized.message),
    stack: safeString(normalized.stack, '').slice(0, 4000),
  });
}

export function startSpan(name, attributes = {}) {
  const started = now();
  const spanTraceId = traceId();
  return {
    traceId: spanTraceId,
    end(status = 'ok', extra = {}) {
      return observe('span', {
        ...attributes,
        ...extra,
        name: safeString(name),
        status: safeString(status),
        durationMs: Math.max(0, Math.round(now() - started)),
        spanTraceId,
      });
    },
  };
}

export function configureObservability(config = {}) {
  if (typeof globalThis === 'undefined') return;
  globalThis.LF_OBSERVABILITY = { ...(globalThis.LF_OBSERVABILITY || {}), ...config };
}
