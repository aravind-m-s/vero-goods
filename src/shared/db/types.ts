// Infrastructure types with no single feature owner.

/** Monotonic counters (order numbers, invoice numbers). One document per sequence. */
export interface Counter {
  id: string;
  seq: number;
}
