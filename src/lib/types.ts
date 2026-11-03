export type PairwiseBalance = {
  counterpartId: string;
  counterpartName: string | null;
  counterpartImage?: string | null;
  netCents: number;
};

export type BucketMemberInfo = {
  userId: string;
  name: string | null;
  lastSubsetIds: string[];
};

export type PendingSettlement = {
  id: string;
  bucketId: string;
  payerId: string;
  receiverId: string;
  amountCents: number;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  createdAt: Date;
  resolvedAt: Date | null;
  payerName: string | null;
  receiverName: string | null;
};

export type RecentExpense = {
  id: string;
  description: string;
  totalAmountCents: number;
  mode: string;
  createdAt: Date;
  payerName: string | null;
};

export type BucketSummary = {
  bucket: {
    id: string;
    name: string;
    description: string | null;
    inviteCode: string;
    createdBy: string;
    createdAt: Date;
  };
  members: BucketMemberInfo[];
  balances: PairwiseBalance[];
  pendingSettlements: PendingSettlement[];
  recentExpenses: RecentExpense[];
};

export type AppNotification = {
  id: string;
  userId: string;
  bucketId: string | null;
  settlementId: string | null;
  type: "SETTLEMENT_PENDING" | "SETTLEMENT_CONFIRMED" | "SETTLEMENT_REJECTED";
  message: string;
  read: boolean;
  createdAt: Date;
};

export type BucketListItem = {
  bucket: {
    id: string;
    name: string;
    description: string | null;
    inviteCode: string;
    createdAt: Date;
  };
  memberCount: number;
};
