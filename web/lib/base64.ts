// Bytes-only base64 helpers for signatures and account data.
// Do not pass arbitrary text here; encode text with TextEncoder first.
function bytesToBinary(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return binary;
}

/** Encodes raw bytes to base64. */
export function encodeBase64(bytes: Uint8Array): string {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(bytesToBinary(bytes));
  }

  return Buffer.from(bytes).toString('base64');
}

/** Decodes a base64 string to raw bytes. */
export function decodeBase64(value: string): Uint8Array {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }

  return Uint8Array.from(Buffer.from(value, 'base64'));
}
