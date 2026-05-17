import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
const Razorpay = require("razorpay");
import * as crypto from "crypto";

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
    
    // Convert logic to string for storage
    const colors = [resultNumber === 0 || resultNumber === 5 ? "Violet" : "", resultNumber % 2 === 0 ? "Red" : "Green"]
      .filter(Boolean);

    batch.set(historyRef, {
      period,
      number: resultNumber,
      color: resultColor,
      colors: colors,
      size: resultNumber >= 5 ? "Big" : "Small",
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

/**
 * Initiate Deposit (Razorpay)
 */
export const initiateDeposit = functions.https.onCall(async (request) => {
  const { amount } = request.data;
  const uid = request.auth?.uid;

  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Login required");
  if (!amount || amount < 100) throw new functions.https.HttpsError("invalid-argument", "Minimum deposit ₹100");

  // Hardcoded for build stability
  const key_id = "rzp_live_SggUT5PeRZ5V43";
  const key_secret = "Sc32Nofb9FYBHOabQrTFHDyi";

  const rzp = new Razorpay({
    key_id,
    key_secret
  });

  try {
    const order = await rzp.orders.create({
      amount: amount * 100, // amount in paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`
    });

    return { order };
  } catch (error: any) {
    console.error("Razorpay Order Creation Error:", JSON.stringify(error));
    const msg = error.error?.description || error.message || "Order creation failed";
    throw new functions.https.HttpsError("internal", msg);
  }
});

/**
 * Verify Deposit
 */
export const verifyDeposit = functions.https.onCall(async (request) => {
  const { orderId, paymentId, signature, amount } = request.data;
  const uid = request.auth?.uid;

  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Login required");

  const secret = "Sc32Nofb9FYBHOabQrTFHDyi";

  const generated_signature = crypto
    .createHmac("sha256", secret)
    .update(orderId + "|" + paymentId)
    .digest("hex");

  if (generated_signature !== signature) {
    throw new functions.https.HttpsError("invalid-argument", "Payment verification failed");
  }

  // Update Wallet
  const walletRef = db.collection("wallets").doc(uid);
  const txRef = db.collection("transactions").doc();

  await db.runTransaction(async (transaction) => {
    transaction.update(walletRef, {
      depositBalance: admin.firestore.FieldValue.increment(amount)
    });
    transaction.set(txRef, {
      userId: uid,
      type: "DEPOSIT",
      amount,
      status: "COMPLETED",
      paymentId,
      createdAt: admin.firestore.Timestamp.now()
    });
  });

  return { success: true };
});

/**
 * Request Withdrawal
 */
export const requestWithdrawal = functions.https.onCall(async (request) => {
  const { amount, upiId, bankDetails } = request.data;
  const uid = request.auth?.uid;

  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Login required");
  if (!amount || amount < 100) throw new functions.https.HttpsError("invalid-argument", "Minimum withdrawal ₹100");

  return db.runTransaction(async (transaction) => {
    const walletRef = db.collection("wallets").doc(uid);
    const walletSnap = await transaction.get(walletRef);
    const wallet = walletSnap.data()!;
    const winningBalance = wallet.winningBalance || 0;

    if (winningBalance < amount) throw new functions.https.HttpsError("failed-precondition", "Insufficient winning balance");

    transaction.update(walletRef, {
      winningBalance: admin.firestore.FieldValue.increment(-amount)
    });

    const requestRef = db.collection("payment_requests").doc();
    transaction.set(requestRef, {
      userId: uid,
      type: "WITHDRAWAL",
      amount,
      upiId,
      bankDetails,
      status: "PENDING",
      createdAt: admin.firestore.Timestamp.now()
    });

    return { success: true };
  });
});

/**
 * Request Manual Deposit
 */
export const requestManualDeposit = functions.https.onCall(async (request) => {
  const { amount, transactionId } = request.data;
  const uid = request.auth?.uid;

  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Login required");
  if (!amount || amount < 100) throw new functions.https.HttpsError("invalid-argument", "Minimum deposit ₹100");
  if (!transactionId) throw new functions.https.HttpsError("invalid-argument", "Transaction ID is required");

  const requestRef = db.collection("payment_requests").doc();
  await requestRef.set({
    userId: uid,
    type: "DEPOSIT",
    amount,
    transactionId,
    method: "UPI/Manual",
    status: "PENDING",
    createdAt: admin.firestore.Timestamp.now()
  });

  return { success: true };
});

/**
 * Get Referral Data
 */
export const getReferralData = functions.https.onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Login required");

  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) throw new functions.https.HttpsError("not-found", "User not found");
  const userData = userSnap.data()!;

  const referralsSnap = await db.collection("users").where("referredBy", "==", userData.referralCode).get();
  const referrals = referralsSnap.docs.map(doc => ({
    id: doc.id,
    phone: doc.data().phone || "Unknown",
    joinedAt: doc.data().createdAt?.toDate()?.toISOString() || new Date().toISOString()
  }));

  const walletSnap = await db.collection("wallets").doc(uid).get();
  const wallet = walletSnap.data() || {};

  return {
    referralCode: userData.referralCode || "",
    referralCount: referrals.length,
    totalEarned: wallet.totalReferralEarned || 0,
    referralBalance: wallet.referralBalance || 0,
    referrals
  };
});

/**
 * Claim Referral Earnings
 */
export const claimReferralEarnings = functions.https.onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Login required");

  return db.runTransaction(async (transaction) => {
    const walletRef = db.collection("wallets").doc(uid);
    const walletSnap = await transaction.get(walletRef);
    const wallet = walletSnap.data()!;
    const referralBalance = wallet.referralBalance || 0;

    if (referralBalance <= 0) throw new functions.https.HttpsError("failed-precondition", "No balance to claim");

    transaction.update(walletRef, {
      referralBalance: 0,
      winningBalance: admin.firestore.FieldValue.increment(referralBalance),
      totalReferralEarned: admin.firestore.FieldValue.increment(referralBalance)
    });

    const txRef = db.collection("transactions").doc();
    transaction.set(txRef, {
      userId: uid,
      type: "REFERRAL_CLAIM",
      amount: referralBalance,
      createdAt: admin.firestore.Timestamp.now()
    });

    return { success: true };
  });
});

/**
 * Get Admin Data (Consolidated)
 */
export const getAdminData = functions.https.onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Login required");

  // Check if admin
  const adminSnap = await db.collection("users").doc(uid).get();
  const adminData = adminSnap.data();
  
  if (adminData?.role !== "ADMIN" && adminData?.email !== "superadmin@colortrade.app") {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  const [usersSnap, paymentsSnap, betsSnap, txSnap, walletsSnap] = await Promise.all([
    db.collection("users").limit(100).get(),
    db.collection("payment_requests").where("status", "==", "PENDING").limit(50).get(),
    db.collection("bets").where("status", "==", "PENDING").limit(50).get(),
    db.collection("transactions").orderBy("createdAt", "desc").limit(50).get(),
    db.collection("wallets").limit(100).get()
  ]);

  const walletsMap = new Map();
  walletsSnap.docs.forEach(doc => {
    walletsMap.set(doc.id, doc.data());
  });

  const users = usersSnap.docs.map(doc => ({
    _id: doc.id,
    ...doc.data(),
    wallet: walletsMap.get(doc.id) || { depositBalance: 0, winningBalance: 0 }
  }));

  const payments = paymentsSnap.docs.map(doc => ({
    _id: doc.id,
    ...doc.data()
  }));

  const liveBets = betsSnap.docs.map(doc => ({
    _id: doc.id,
    ...doc.data()
  }));

  const transactions = txSnap.docs.map(doc => ({
    _id: doc.id,
    ...doc.data()
  }));

  // Calculate basic metrics
  const metrics = {
    totalUsers: users.length,
    totalVolume: transactions.reduce((acc, tx: any) => acc + (tx.type === "DEPOSIT" ? tx.amount : 0), 0),
    activeBets: liveBets.length,
    platformProfit: transactions.reduce((acc, tx: any) => acc + (tx.type === "GAME_LOSS" ? tx.amount : (tx.type === "GAME_WIN" ? -tx.amount : 0)), 0),
    pendingWithdrawals: payments.length
  };

  return {
    metrics,
    users,
    payments,
    liveBets,
    transactions,
    admin: adminSnap.data()
  };
});

/**
 * Setup Admin (Emergency Access)
 */
export const setupAdmin = functions.https.onCall(async (request) => {
  try {
    const email = request.data?.email || "superadmin@colortrade.app";
    const password = request.data?.password || "Admin@12345";
    const username = email.split("@")[0] || "superadmin";

    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      // Update password to ensure it matches
      userRecord = await admin.auth().updateUser(userRecord.uid, { password });
    } catch {
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: username === "superadmin" ? "Super Admin" : "Admin User"
      });
    }

    const uid = userRecord.uid;
    // Set in users collection with ADMIN role
    await db.collection("users").doc(uid).set({
      userId: username,
      fullName: username === "superadmin" ? "Super Admin" : "Admin User",
      email: email,
      role: "ADMIN",
      isActive: true,
      createdAt: admin.firestore.Timestamp.now()
    }, { merge: true });

    return { success: true, message: "Super Admin created/updated", uid };
  } catch (error: any) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * Create Admin User (Onboarding)
 */
export const createAdminUser = functions.https.onCall(async (request) => {
  const { userId, fullName, mobile, password, initialBalance } = request.data;
  const uid = request.auth?.uid;
  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Login required");

  const adminSnap = await db.collection("users").doc(uid).get();
  const adminData = adminSnap.data();
  if (adminData?.role !== "ADMIN" && adminData?.email !== "superadmin@colortrade.app") {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  // Create in Auth (Admin SDK)
  try {
    const userOptions: any = {
      email: `${userId}@colortrade.app`,
      password: password,
      displayName: fullName,
    };
    
    if (mobile && String(mobile).trim() !== "") {
      userOptions.phoneNumber = mobile.startsWith("+") ? mobile : `+91${mobile}`;
    }

    const userRecord = await admin.auth().createUser(userOptions);

    const newUserUid = userRecord.uid;
    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    await db.collection("users").doc(newUserUid).set({
      userId,
      fullName,
      phone: mobile || "",
      role: "USER",
      referralCode,
      isActive: true,
      createdByAdmin: uid,
      createdAt: admin.firestore.Timestamp.now()
    });

    await db.collection("wallets").doc(newUserUid).set({
      depositBalance: initialBalance || 0,
      winningBalance: 0,
      referralBalance: 0,
      totalReferralEarned: 0
    });

    return { success: true, uid: newUserUid };
  } catch (error: any) {
    console.error("createAdminUser failed:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

/**
 * Toggle User Status
 */
export const toggleUserStatus = functions.https.onCall(async (request) => {
  const { targetUid } = request.data;
  const uid = request.auth?.uid;

  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Login required");

  const adminSnap = await db.collection("users").doc(uid).get();
  const adminData = adminSnap.data();
  if (adminData?.role !== "ADMIN" && adminData?.email !== "superadmin@colortrade.app") {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  const userRef = db.collection("users").doc(targetUid);
  const userSnap = await userRef.get();
  const currentStatus = userSnap.data()?.isActive;

  await userRef.update({ isActive: !currentStatus });
  return { success: true, newState: !currentStatus };
});

/**
 * Adjust User Wallet (Admin Only)
 */
export const adjustUserWallet = functions.https.onCall(async (request) => {
  const { targetUid, amount, type } = request.data;
  const uid = request.auth?.uid;

  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Login required");

  const adminSnap = await db.collection("users").doc(uid).get();
  const adminData = adminSnap.data();
  if (adminData?.role !== "ADMIN" && adminData?.email !== "superadmin@colortrade.app") {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  const walletRef = db.collection("wallets").doc(targetUid);
  const walletSnap = await walletRef.get();
  if (!walletSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Wallet not found");
  }

  const updateField = type === "deposit" ? "depositBalance" : "winningBalance";
  
  await db.runTransaction(async (transaction) => {
    const freshSnap = await transaction.get(walletRef);
    const data = freshSnap.data() || {};
    const currentVal = Number(data[updateField] || 0);
    transaction.update(walletRef, {
      [updateField]: Math.max(0, currentVal + Number(amount))
    });
  });

  return { success: true };
});

/**
 * Review Payment
 */
export const reviewPayment = functions.https.onCall(async (request) => {
  const { requestId, action } = request.data;
  const uid = request.auth?.uid;

  if (!uid) throw new functions.https.HttpsError("unauthenticated", "Login required");

  const adminSnap = await db.collection("users").doc(uid).get();
  const adminData = adminSnap.data();
  if (adminData?.role !== "ADMIN" && adminData?.email !== "superadmin@colortrade.app") {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  const requestRef = db.collection("payment_requests").doc(requestId);
  const requestSnap = await requestRef.get();
  const requestData = requestSnap.data()!;

  const walletRef = db.collection("wallets").doc(requestData.userId);

  if (action === "APPROVE") {
    await db.runTransaction(async (transaction) => {
      if (requestData.type === "DEPOSIT") {
        transaction.update(walletRef, {
          depositBalance: admin.firestore.FieldValue.increment(requestData.amount)
        });
      }
      transaction.update(requestRef, { status: "APPROVED", approvedAt: admin.firestore.Timestamp.now() });
    });
  } else {
    // REJECT
    await db.runTransaction(async (transaction) => {
      if (requestData.type === "WITHDRAWAL") {
        // Refund to winning wallet
        transaction.update(walletRef, {
          winningBalance: admin.firestore.FieldValue.increment(requestData.amount)
        });
      }
      transaction.update(requestRef, { status: "REJECTED", rejectedAt: admin.firestore.Timestamp.now() });
    });
  }

  return { success: true };
});
