/** Core domain types. Pure — no Expo/React imports allowed in this folder. */

export interface Category {
  id: string;
  name: string;
  /** Position in the user-defined ordering, 0-based. */
  sortOrder: number;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

export interface Expense {
  id: string;
  categoryId: string;
  /** Empty string means "no note". */
  note: string;
  /** Money is always integer cents; never floats. */
  amountCents: number;
  /** ISO date YYYY-MM-DD, no time component. */
  spentOn: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** Fields the user supplies when creating/editing an expense. */
export interface ExpenseInput {
  categoryId: string;
  note: string;
  amountCents: number;
  spentOn: string;
}

/** Per-category spend total for a period (Charts tab, legend). */
export interface CategorySummary {
  categoryId: string;
  name: string;
  totalCents: number;
}
