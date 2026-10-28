// Easy-to-read reference codes (no 0/O/1/I/L) — e.g. R-7KQ2PX for rides.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomInts(n) {
  const arr = new Uint32Array(n);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(arr);
  else for (let i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 2 ** 32);
  return arr;
}

export function shortCode(prefix, length = 6) {
  const body = Array.from(randomInts(length), (x) => ALPHABET[x % ALPHABET.length]).join("");
  return prefix ? `${prefix}-${body}` : body;
}
