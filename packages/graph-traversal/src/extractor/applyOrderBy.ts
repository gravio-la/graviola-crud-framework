/**
 * Prisma-style orderBy helpers for sorting extracted object arrays.
 *
 * These utilities provide deterministic in-memory sorting for arrays extracted
 * from RDF/SPARQL CONSTRUCT results. SPARQL CONSTRUCT builds an unordered
 * triple set, so ORDER BY in a SUBSELECT does not guarantee extraction order.
 * Applying the same orderBy criteria after extraction ensures consistent results
 * regardless of the underlying SPARQL engine's triple ordering.
 */

import type { OrderByClause } from "@graviola/edb-core-types";

/**
 * Normalize orderBy to array format.
 * Converts a single object `{ name: 'asc' }` or an array of objects to a
 * consistent array, e.g. `[{ name: 'asc' }]`.
 */
export function normalizeOrderBy(
  orderBy: OrderByClause | OrderByClause[] | undefined,
): OrderByClause[] {
  if (!orderBy) return [];
  return Array.isArray(orderBy) ? orderBy : [orderBy];
}

/**
 * Compare two extracted objects using Prisma-style orderBy clauses.
 *
 * Clauses are applied in array order (first clause is primary, subsequent
 * clauses break ties). Within each clause, all keys are applied in iteration
 * order (handles the `{ lastName: 'asc', firstName: 'asc' }` single-object form).
 *
 * Returns a negative number, zero, or positive number (like `Array.prototype.sort`).
 */
export function compareByOrderBy(
  a: Record<string, any>,
  b: Record<string, any>,
  clauses: OrderByClause[],
): number {
  for (const clause of clauses) {
    for (const [property, direction] of Object.entries(clause)) {
      if (!direction) continue;
      const aVal = a[property];
      const bVal = b[property];

      // Treat missing values as sorting after all present values
      if (aVal === undefined || aVal === null) {
        if (bVal !== undefined && bVal !== null) return 1;
        continue;
      }
      if (bVal === undefined || bVal === null) return -1;

      let cmp: number;
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }

      if (cmp !== 0) {
        return direction === "desc" ? -cmp : cmp;
      }
    }
  }
  return 0;
}

/**
 * Sort an array of extracted objects by Prisma-style orderBy clauses.
 *
 * Returns a **new** sorted array (does not mutate the original).
 * If `orderBy` is undefined/empty, returns the array unchanged.
 */
export function sortObjectArrayByOrderBy<T extends Record<string, any>>(
  array: T[],
  orderBy: OrderByClause | OrderByClause[] | undefined,
): T[] {
  const clauses = normalizeOrderBy(orderBy);
  if (clauses.length === 0) return array;
  return [...array].sort((a, b) => compareByOrderBy(a, b, clauses));
}
