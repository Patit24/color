# Database Schema

MongoDB collections for the production backend:

```ts
users {
  _id, name, phone, email, firebaseUid, passwordHash?,
  referralCode, referredBy, role, status, kycStatus,
  deviceFingerprints[], createdAt, updatedAt
}

wallets {
  _id, userId, depositBalance, winningBalance, bonusBalance,
  referralBalance, lockedBalance, withdrawableBalance
}

walletLedger {
  _id, userId, walletId, type, amount, balanceAfter,
  referenceId, status, metadata, createdAt
}

rounds {
  _id, gameMode, period, status, seedHash, revealedSeed,
  resultNumber, resultColor, resultSize, bettingOpenedAt,
  bettingLockedAt, settledAt, createdAt
}

bets {
  _id, userId, roundId, period, targetType, targetValue,
  amount, multiplier, odds, status, payout, profit, createdAt
}

paymentRequests {
  _id, userId, type, provider, amount, status,
  providerReference, reviewedBy, reviewedAt, createdAt
}

referrals {
  _id, inviterId, invitedUserId, level, commissionRate,
  totalCommission, status, createdAt
}

fraudEvents {
  _id, userId, eventType, severity, score, evidence,
  status, reviewedBy, createdAt
}

notifications {
  _id, userId, title, body, readAt, createdAt
}

adminAuditLogs {
  _id, adminId, action, resourceType, resourceId,
  before, after, ipAddress, createdAt
}
```

Outcome management should stay provably fair. Admin tools can pause games,
void rounds, review accounts, and change future odds, but should not secretly
alter live results.
