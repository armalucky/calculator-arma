import { parentPort } from 'node:worker_threads';
// Browser worker bridge: execute the production worker and its transfer protocol in Node.
globalThis.postMessage = (data, options) => parentPort.postMessage(data, options?.transfer);
await import('../../features/planning/planning.worker.ts');
parentPort.on('message', (data) => globalThis.onmessage({ data }));
parentPort.postMessage('ready');
