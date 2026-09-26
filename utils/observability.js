const OBSERVABILITY_VERSION = '1';

function getConfig() {
  const config = typeof globalThis !== 'undefined' && globalThis.LF_OBSERVABILITY;
  return config && typeof config === 'object' ? config : {};
}

const SENSITIVE_PATTERNS = [
  /([?&](?:apikey|api_key|token|access_token|auth|password|secret)=)[^&\s]+/gi,
  /(Bearer\s+)[A-Za-z0-9._~+/-]+/gi,
  /(Basic\s+)[A-Za-z0-9+/=]+/gi,
];

export function redactSensitive(value) {
  if (typeof value !== 'string') return value;
  let result = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '$1[REDACTED]');
  }
  return result;
}

function safeString(value, fallback = 'unknown') {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return redactSensitive(value.trim()).slice(0, 200);
}

function safeText(value, maxLength = 4000) {
  if (typeof value !== 'string' || !value.trim()) return '';
  return redactSensitive(value.trim()).slice(0, maxLength);
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
    stack: safeText(normalized.stack, 4000),
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
