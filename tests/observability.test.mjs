import assert from 'node:assert/strict';
import { configureObservability, observe, observeError, startSpan } from '../utils/observability.js';

configureObservability({ serviceName: 'test-client', serviceVersion: 'test', environment: 'test' });

const event = observe('test.event', { answer: 42 });
assert.equal(event.type, 'test.event');
assert.equal(event.serviceName, 'test-client');
assert.equal(event.attributes.answer, 42);
assert.match(event.traceId, /./);

const errorEvent = observeError(new Error('boom'), { source: 'test' });
assert.equal(errorEvent.type, 'exception');
assert.equal(errorEvent.attributes.errorType, 'Error');
assert.equal(errorEvent.attributes.source, 'test');

const sensitiveError = observeError(new Error('Failed to fetch https://api.supabase.co/rest/v1/words?apikey=secret_jwt_token_123 with Bearer my_secret_token'));
assert.equal(sensitiveError.attributes.message.includes('secret_jwt_token_123'), false);
assert.equal(sensitiveError.attributes.message.includes('my_secret_token'), false);
assert.match(sensitiveError.attributes.message, /apikey=\[REDACTED\]/);
assert.match(sensitiveError.attributes.message, /Bearer\s+\[REDACTED\]/);

const span = startSpan('test.operation', { route: 'test' });
const spanEvent = span.end('ok', { result: 'pass' });
assert.equal(spanEvent.type, 'span');
assert.equal(spanEvent.attributes.name, 'test.operation');
assert.equal(spanEvent.attributes.status, 'ok');
assert.equal(spanEvent.attributes.result, 'pass');
assert.equal(typeof spanEvent.attributes.durationMs, 'number');

console.log('Observability contract tests passed.');
