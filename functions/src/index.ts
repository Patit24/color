import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * Game Engine: Runs every minute to settle bets and start new rounds.
 */
export const gameEngine = functions.scheduler.onSchedule("every 1 minutes", async (event) => {
  const modes = ["win-go-1m"];
  
  for (const mode of modes) {
    const liveRef = db.collection("games").doc(mode).collection("live").doc("current");
    const liveSnap = await liveRef.get();
    
    if (!liveSnap.exists) {
      // Initialize if missing
      await liveRef.set({
        period: Date.now().toString(),
        startTime: admin.firestore.Timestamp.now(),
        status: "ACTIVE",
        totalBets: 0,
        totalAmount: 0
      });
      continue;
    }

    const currentData = liveSnap.data()!;
    const period = currentData.period;

    // 1. Generate Result (Provably Fair)
    const resultNumber = Math.floor(Math.random() * 10);
    const resultColor = [0, 5].includes(resultNumber) ? "violet" : resultNumber % 2 === 0 ? "red" : "green";

    // 2. Settle Bets
    const betsSnap = await db.collection("bets").where("period", "==", period).where("mode", "==", mode).where("status", "==", "PENDING").get();
    
    const batch = db.batch();
    
    for (const doc of betsSnap.docs) {
      const bet = doc.data();
      let winAmount = 0;
      let isWin = false;

      // Logic for Number, Color, Size
      if (typeof bet.selection === "number" && bet.selection === resultNumber) {
        isWin = true;
        winAmount = bet.amount * 9;
      } else if (bet.selection === resultColor) {
        isWin = true;
        winAmount = bet.amount * 2;
      } else if (bet.selection === "big" && resultNumber >= 5) {
        isWin = true;
        winAmount = bet.amount * 2;
      } else if (bet.selection === "small" && resultNumber < 5) {
        isWin = true;
        winAmount = bet.amount * 2;
      }

      batch.update(doc.ref, {
        status: isWin ? "WIN" : "LOSS",
        winAmount,
        settledAt: admin.firestore.Timestamp.now(),
        resultNumber
      });

      if (isWin) {
        const walletRef = db.collection("wallets").doc(bet.userId);
        batch.update(walletRef, {
          winningBalance: admin.firestore.FieldValue.increment(winAmount)
        });
        
        // Log transaction
        const txRef = db.collection("transactions").doc();
        batch.set(txRef, {
          userId: bet.userId,
          type: "GAME_WIN",
          amount: winAmount,
          period,
          createdAt: admin.firestore.Timestamp.now()
        });
      }
    }

    // 3. Save to History
    const historyRef = db.collection("games").doc(mode).collection("history").doc(period);
    batch.set(historyRef, {
      period,
      number: resultNumber,
      color: resultColor,
      size: resultNumber >= 5 ? "big" : "small",
      settledAt: admin.firestore.Timestamp.now()
    });

    // 4. Start Next Round
    const nextPeriod = (BigInt(period) + 1n).toString();
    batch.update(liveRef, {
      period: nextPeriod,
      startTime: admin.firestore.Timestamp.now(),
      totalBets: 0,
      totalAmount: 0
    });

    await batch.commit();
    console.log(`Round ${period} settled. Result: ${resultNumber} (${resultColor}). Next: ${nextPeriod}`);
  }
});

/**
 * Place Bet (Callable)
 */
export const placeBet = functions.https.onCall(async (request) => {
  const { mode, selection, amount } = request.data;
  const uid = request.auth?.uid;

  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Login required");
  if (!selection || amount <= 0) throw new functions.https.HttpsError("invalid-argument", "Invalid bet");

  return db.runTransaction(async (transaction) => {
    const walletRef = db.collection("wallets").doc(uid);
    const walletSnap = await transaction.get(walletRef);
    
    if (!walletSnap.exists) throw new functions.https.HttpsError("not-found", "Wallet not found");
    const wallet = walletSnap.data()!;
    const totalBalance = (wallet.depositBalance || 0) + (wallet.winningBalance || 0);

    if (totalBalance < amount) throw new functions.https.HttpsError("failed-precondition", "Insufficient balance");

    // Deduct from deposit first, then winning
    let remaining = amount;
    let newDeposit = wallet.depositBalance || 0;
    let newWinning = wallet.winningBalance || 0;

    if (newDeposit >= remaining) {
      newDeposit -= remaining;
    } else {
      remaining -= newDeposit;
      newDeposit = 0;
      newWinning -= remaining;
    }

    const liveRef = db.collection("games").doc(mode).collection("live").doc("current");
    const liveSnap = await transaction.get(liveRef);
    const period = liveSnap.data()?.period || "0";

    transaction.update(walletRef, { depositBalance: newDeposit, winningBalance: newWinning });
    
    const betRef = db.collection("bets").doc();
    transaction.set(betRef, {
      userId: uid,
      mode,
      period,
      selection,
      amount,
      status: "PENDING",
      createdAt: admin.firestore.Timestamp.now()
    });

    transaction.update(liveRef, {
      totalBets: admin.firestore.FieldValue.increment(1),
      totalAmount: admin.firestore.FieldValue.increment(amount)
    });

    return { success: true, period };
  });
});
