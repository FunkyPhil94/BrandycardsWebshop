/** D1 rejects a statement that binds too many parameters with
 * "too many SQL variables". The ceiling applies per statement, not per batch,
 * so bulk writes have to be sized from the widest statement they produce:
 * an id list costs one parameter per id, a multi-row insert costs one per row
 * *and column*. These constants stay conservative and are covered by
 * tests/d1-limits.test.mjs, which measures the real generated SQL.
 */
export const D1_MAX_BOUND_PARAMS = 100;

/** Headroom for the SET clause that accompanies an id list. */
export const D1_SAFE_ID_LIST = 40;

/** Largest multi-row insert for a table with the given column count. */
export function maxInsertRows(columnCount: number) {
  return Math.max(1, Math.floor((D1_MAX_BOUND_PARAMS - 10) / columnCount));
}
