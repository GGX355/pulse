// Secure rejection sampling preserves node:crypto.randomInt's uniform contract.
export function randomInt(max) {
  if (!Number.isSafeInteger(max) || max < 1 || max > 0x100000000) throw new RangeError('Invalid random bound');
  const cap = Math.floor(0x100000000 / max) * max;
  const values = new Uint32Array(1);
  do { crypto.getRandomValues(values); } while (values[0] >= cap);
  return values[0] % max;
}
