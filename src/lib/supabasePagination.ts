import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch ALL rows of a query in pages of `pageSize` (default 1000).
 * Bypasses PostgREST's default 1000-row response cap.
 *
 * Usage:
 *   const rows = await fetchAllPaginated("transactions", "*", q => q.eq("user_id", uid));
 *
 * The `apply` callback may add filters/order. A stable order is important to keep
 * pages disjoint — if you don't supply one, we order by `created_at` ascending.
 */
export async function fetchAllPaginated<T = any>(
  table: string,
  columns: string = "*",
  apply?: (q: any) => any,
  pageSize: number = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q: any = (supabase as any).from(table).select(columns);
    if (apply) q = apply(q);
    // Add a default stable order if caller didn't (PostgREST is permissive about
    // multiple .order() calls — the first one wins for ties).
    q = q.order("created_at", { ascending: true });
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/**
 * Cursor-style pagination for UI lists ordered by `created_at DESC`.
 * Returns one page plus a cursor (the oldest `created_at` of this page) for the next call.
 */
export interface CursorPage<T> {
  rows: T[];
  nextCursor: string | null; // ISO timestamp; null when no more rows
}

export async function fetchPageByCreatedAtDesc<T = any>(
  table: string,
  columns: string = "*",
  apply?: (q: any) => any,
  cursor?: string | null,
  pageSize: number = 50,
): Promise<CursorPage<T>> {
  let q: any = (supabase as any).from(table).select(columns);
  if (apply) q = apply(q);
  if (cursor) q = q.lt("created_at", cursor);
  q = q.order("created_at", { ascending: false }).limit(pageSize);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as T[];
  const nextCursor =
    rows.length === pageSize ? (rows[rows.length - 1] as any).created_at ?? null : null;
  return { rows, nextCursor };
}