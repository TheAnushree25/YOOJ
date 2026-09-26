/**
 * A ceiling on how often one caller can do one thing.
 *
 * Kept in the memory of a warm function, so it is a speed bump rather than a
 * wall: each instance counts on its own and forgets on a cold start. That is
 * the right weight for what it guards - the gate and the sign-up form, whose
 * worst case is a spreadsheet filling with nonsense - without a store to run.
 */
const hits = new Map<string, number[]>();

/** Whether `key` may act again, counting this attempt if it may. */
export const allow = (key: string, max: number, windowMs: number, now = Date.now()) => {
  const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Bounded, oldest first: a flood of distinct callers cannot grow it forever.
  if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
  return true;
};
