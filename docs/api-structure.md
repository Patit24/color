# REST API Structure

```txt
POST /api/auth/login
POST /api/auth/register
POST /api/auth/firebase

GET  /api/wallet
POST /api/deposit
POST /api/withdraw

GET  /api/rounds/live
GET  /api/history
GET  /api/bets
POST /api/bets

GET  /api/referrals
POST /api/referrals/claim

GET  /api/admin/metrics
GET  /api/admin/users
POST /api/admin/users/:id/ban
GET  /api/admin/deposits
GET  /api/admin/withdrawals
POST /api/admin/withdrawals/:id/review
```

Socket.io events:

```txt
client: join_round, place_bet, subscribe_wallet
server: countdown_update, result_declared, wallet_update, bet_status
```
