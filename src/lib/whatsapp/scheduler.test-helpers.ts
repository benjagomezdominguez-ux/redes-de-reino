// A small in-memory fake of the subset of the Supabase query builder that
// scheduler.ts actually uses (select/eq/in/lt/ilike/order/limit/single/
// maybeSingle, update, insert, upsert) plus the one embedded-relation
// case the scheduler reads (whatsapp_message_deliveries -> its
// whatsapp_contacts row). Built as a real filtered in-memory store rather
// than canned per-call responses because the scheduler queries the same
// tables multiple times per run with different filters — a call-order
// mock would be too brittle to express that faithfully.

type Row = Record<string, unknown>;

const DEFAULTS: Record<string, () => Row> = {
  whatsapp_message_deliveries: () => ({
    status: "pending",
    attempt_count: 0,
    external_message_id: null,
    error_code: null,
    error_message: null,
    last_attempt_at: null,
    sent_at: null,
  }),
  whatsapp_notifications: () => ({ notification_type: "cycle_ending_soon" }),
  audit_log: () => ({}),
};

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `row-${idCounter}`;
}

type PendingOp =
  | { type: "select" }
  | { type: "update"; patch: Row }
  | { type: "insert"; rows: Row[] }
  | { type: "upsert"; rows: Row[]; onConflict?: string; ignoreDuplicates?: boolean }
  | { type: "delete" };

class FakeQuery implements PromiseLike<{ data: unknown; error: unknown; count?: number | null }> {
  private filters: Array<(r: Row) => boolean> = [];
  private orderCol?: { col: string; ascending: boolean };
  private limitN?: number;
  private singleMode: "none" | "single" | "maybeSingle" = "none";
  private op: PendingOp = { type: "select" };
  private selectAfterWrite = false;
  private embedCols: string[] = [];
  private countMode = false;

  constructor(
    private store: FakeStore,
    private table: string
  ) {}

  select(cols = "", opts?: { count?: "exact"; head?: boolean }) {
    if (this.op.type !== "select") this.selectAfterWrite = true;
    const embedMatches = [...cols.matchAll(/(\w+)\(/g)].map((m) => m[1]);
    this.embedCols.push(...embedMatches);
    if (opts?.count === "exact") this.countMode = true;
    return this;
  }
  delete() {
    this.op = { type: "delete" };
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  lt(col: string, val: number) {
    this.filters.push((r) => (r[col] as number) < val);
    return this;
  }
  ilike(col: string, pattern: string) {
    const regex = new RegExp(`^${pattern.replace(/%/g, ".*")}$`, "i");
    this.filters.push((r) => regex.test(String(r[col] ?? "")));
    return this;
  }
  order(col: string, opts: { ascending: boolean }) {
    this.orderCol = { col, ascending: opts.ascending };
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  update(patch: Row) {
    this.op = { type: "update", patch };
    return this;
  }
  insert(rowOrRows: Row | Row[]) {
    this.op = { type: "insert", rows: Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows] };
    return this;
  }
  upsert(rowOrRows: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.op = {
      type: "upsert",
      rows: Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows],
      onConflict: opts?.onConflict,
      ignoreDuplicates: opts?.ignoreDuplicates,
    };
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }
  single() {
    this.singleMode = "single";
    return this;
  }

  then<TResult1 = { data: unknown; error: unknown; count?: number | null }, TResult2 = never>(
    onFulfilled?: ((value: { data: unknown; error: unknown; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onFulfilled, onRejected);
  }

  private rows(): Row[] {
    return this.store.tables[this.table] ?? (this.store.tables[this.table] = []);
  }

  private applyFilters(rows: Row[]): Row[] {
    return rows.filter((r) => this.filters.every((f) => f(r)));
  }

  private embed(row: Row): Row {
    if (this.embedCols.length === 0) return row;
    const result = { ...row };
    for (const relTable of this.embedCols) {
      const resolver = this.store.embedResolvers[`${this.table}.${relTable}`];
      if (resolver) result[relTable] = resolver(row, this.store);
    }
    return result;
  }

  private async execute(): Promise<{ data: unknown; error: unknown; count?: number | null }> {
    if (this.op.type === "select") {
      const matched = this.applyFilters(this.rows());
      let result = matched;
      if (this.orderCol) {
        const { col, ascending } = this.orderCol;
        result = [...result].sort((a, b) => {
          const av = a[col] as string | number;
          const bv = b[col] as string | number;
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          return ascending ? cmp : -cmp;
        });
      }
      if (this.limitN != null) result = result.slice(0, this.limitN);
      result = result.map((r) => this.embed(r));
      const count = this.countMode ? matched.length : null;
      if (this.singleMode !== "none") return { data: result[0] ?? null, error: null, count };
      return { data: result, error: null, count };
    }

    if (this.op.type === "delete") {
      const targets = this.applyFilters(this.rows());
      this.store.tables[this.table] = this.rows().filter((r) => !targets.includes(r));
      return { data: null, error: null };
    }

    if (this.op.type === "update") {
      const targets = this.applyFilters(this.rows());
      for (const t of targets) Object.assign(t, this.op.patch);
      return { data: null, error: null };
    }

    if (this.op.type === "insert") {
      const uniqueGroups = this.store.uniqueConstraints[this.table] ?? [];
      const existingRows = this.rows();
      for (const incoming of this.op.rows) {
        for (const cols of uniqueGroups) {
          if (existingRows.some((r) => cols.every((c) => r[c] === incoming[c]))) {
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
          }
        }
      }
      const defaults = DEFAULTS[this.table]?.() ?? {};
      const inserted = this.op.rows.map((r) => ({ id: nextId(), created_at: new Date().toISOString(), ...defaults, ...r }));
      this.rows().push(...inserted);
      if (this.selectAfterWrite) {
        return this.singleMode !== "none" ? { data: inserted[0], error: null } : { data: inserted, error: null };
      }
      return { data: null, error: null };
    }

    // upsert
    const onConflictCols = this.op.onConflict?.split(",") ?? ["id"];
    const rows = this.rows();
    const upserted: Row[] = [];
    for (const incoming of this.op.rows) {
      const existing = rows.find((r) => onConflictCols.every((c) => r[c] === incoming[c]));
      if (existing) {
        if (!this.op.ignoreDuplicates) Object.assign(existing, incoming);
        upserted.push(existing);
      } else {
        const defaults = DEFAULTS[this.table]?.() ?? {};
        const row = { id: nextId(), created_at: new Date().toISOString(), ...defaults, ...incoming };
        rows.push(row);
        upserted.push(row);
      }
    }
    if (this.selectAfterWrite) {
      return this.singleMode !== "none" ? { data: upserted[0] ?? null, error: null } : { data: upserted, error: null };
    }
    return { data: null, error: null };
  }
}

export class FakeStore {
  tables: Record<string, Row[]> = {};
  embedResolvers: Record<string, (row: Row, store: FakeStore) => unknown> = {
    "whatsapp_message_deliveries.whatsapp_contacts": (row, store) =>
      store.tables.whatsapp_contacts?.find((c) => c.id === row.contact_id) ?? null,
  };
  // Mirrors the DB's unique(group_id, phone_e164) on whatsapp_contacts —
  // lets tests exercise the real "duplicate phone" error path.
  uniqueConstraints: Record<string, string[][]> = {
    whatsapp_contacts: [["group_id", "phone_e164"]],
  };

  seed(table: string, rows: Row[]) {
    this.tables[table] = rows.map((r) => ({ ...r }));
  }

  client() {
    return {
      from: (table: string) => new FakeQuery(this, table),
    };
  }
}
