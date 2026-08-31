import { TextDecoder, TextEncoder } from 'node:util';

Object.assign(globalThis, {
  ...(typeof globalThis.TextDecoder === 'undefined' ? { TextDecoder } : {}),
  ...(typeof globalThis.TextEncoder === 'undefined' ? { TextEncoder } : {}),
  IS_REACT_ACT_ENVIRONMENT: true,
});
