export type ExpenseCategory =
  | "Stay"
  | "Food"
  | "Travel"
  | "Activities"
  | "Drinks"
  | "Other";

export type SplitMode = "equal" | "exact" | "ratio";

export type PaymentMethod = "upi" | "cash";

export interface Member {
  id: string;
  name: string;
  color: string;
  initialAdvance: number;
}

export interface PayerEntry {
  memberId: string;
  amount: number;
  method?: PaymentMethod;
}

export interface SplitEntry {
  memberId: string;
  share: number;
  weight?: number;
}

export interface ExpenseEditRecord {
  editedAt: string;
  changes: string[];
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category?: ExpenseCategory;
  date: string;
  paymentMethod?: PaymentMethod;
  payers: PayerEntry[];
  splitMode: SplitMode;
  splits: SplitEntry[];
  notes?: string;
  editHistory?: ExpenseEditRecord[];
}

export interface CashTransfer {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  date: string;
  method?: PaymentMethod;
  note?: string;
  isSettlement?: boolean;
}

export interface Trip {
  id: string;
  name: string;
  location?: string;
  createdAt: string;
  members: Member[];
  expenses: Expense[];
  transfers: CashTransfer[];
}

export interface MemberBalance {
  member: Member;
  initialAdvance: number;
  totalBillsPaid: number;
  transfersGiven: number;
  transfersReceived: number;
  totalPaidWithAdvance: number;
  totalConsumed: number;
  netBalance: number;
}

export interface SimplifiedTransfer {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}
