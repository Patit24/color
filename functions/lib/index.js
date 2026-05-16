"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewPayment = exports.toggleUserStatus = exports.createAdminUser = exports.getAdminData = exports.claimReferralEarnings = exports.getReferralData = exports.requestWithdrawal = exports.verifyDeposit = exports.initiateDeposit = exports.placeBet = exports.gameEngine = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const Razorpay = require("razorpay");
const crypto = __importStar(require("crypto"));
admin.initializeApp();
const db = admin.firestore();
exports.gameEngine = functions.scheduler.onSchedule("every 1 minutes", async (event) => {
    const modes = ["win-go-1m"];
    for (const mode of modes) {
        const liveRef = db.collection("games").doc(mode).collection("live").doc("current");
        const liveSnap = await liveRef.get();
        if (!liveSnap.exists) {
            await liveRef.set({
                period: Date.now().toString(),
                startTime: admin.firestore.Timestamp.now(),
                status: "ACTIVE",
                totalBets: 0,
                totalAmount: 0
            });
            continue;
        }
        const currentData = liveSnap.data();
        const period = currentData.period;
        const resultNumber = Math.floor(Math.random() * 10);
        const resultColor = [0, 5].includes(resultNumber) ? "violet" : resultNumber % 2 === 0 ? "red" : "green";
        const betsSnap = await db.collection("bets").where("period", "==", period).where("mode", "==", mode).where("status", "==", "PENDING").get();
        const batch = db.batch();
        for (const doc of betsSnap.docs) {
            const bet = doc.data();
            let winAmount = 0;
            let isWin = false;
            if (typeof bet.selection === "number" && bet.selection === resultNumber) {
                isWin = true;
                winAmount = bet.amount * 9;
            }
            else if (bet.selection === resultColor) {
                isWin = true;
                winAmount = bet.amount * 2;
            }
            else if (bet.selection === "big" && resultNumber >= 5) {
                isWin = true;
                winAmount = bet.amount * 2;
            }
            else if (bet.selection === "small" && resultNumber < 5) {
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
        const historyRef = db.collection("games").doc(mode).collection("history").doc(period);
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
exports.placeBet = functions.https.onCall(async (request) => {
    const { mode, selection, amount } = request.data;
    const uid = request.auth?.uid;
    if (!uid)
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    if (!selection || amount <= 0)
        throw new functions.https.HttpsError("invalid-argument", "Invalid bet");
    return db.runTransaction(async (transaction) => {
        const walletRef = db.collection("wallets").doc(uid);
        const walletSnap = await transaction.get(walletRef);
        if (!walletSnap.exists)
            throw new functions.https.HttpsError("not-found", "Wallet not found");
        const wallet = walletSnap.data();
        const totalBalance = (wallet.depositBalance || 0) + (wallet.winningBalance || 0);
        if (totalBalance < amount)
            throw new functions.https.HttpsError("failed-precondition", "Insufficient balance");
        let remaining = amount;
        let newDeposit = wallet.depositBalance || 0;
        let newWinning = wallet.winningBalance || 0;
        if (newDeposit >= remaining) {
            newDeposit -= remaining;
        }
        else {
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
exports.initiateDeposit = functions.https.onCall(async (request) => {
    const { amount } = request.data;
    const uid = request.auth?.uid;
    if (!uid)
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    if (!amount || amount < 100)
        throw new functions.https.HttpsError("invalid-argument", "Minimum deposit ₹100");
    const key_id = "rzp_live_SggUT5PeRZ5V43";
    const key_secret = "Sc32Nofb9FYBHOabQrTFHDyi";
    const rzp = new Razorpay({
        key_id,
        key_secret
    });
    try {
        const order = await rzp.orders.create({
            amount: amount * 100,
            currency: "INR",
            receipt: `rcpt_${uid}_${Date.now()}`
        });
        return { order };
    }
    catch (error) {
        console.error("Razorpay Order Creation Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Order creation failed");
    }
});
exports.verifyDeposit = functions.https.onCall(async (request) => {
    const { orderId, paymentId, signature, amount } = request.data;
    const uid = request.auth?.uid;
    if (!uid)
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    const secret = "Sc32Nofb9FYBHOabQrTFHDyi";
    const generated_signature = crypto
        .createHmac("sha256", secret)
        .update(orderId + "|" + paymentId)
        .digest("hex");
    if (generated_signature !== signature) {
        throw new functions.https.HttpsError("invalid-argument", "Payment verification failed");
    }
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
exports.requestWithdrawal = functions.https.onCall(async (request) => {
    const { amount, upiId, bankDetails } = request.data;
    const uid = request.auth?.uid;
    if (!uid)
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    if (!amount || amount < 500)
        throw new functions.https.HttpsError("invalid-argument", "Minimum withdrawal ₹500");
    return db.runTransaction(async (transaction) => {
        const walletRef = db.collection("wallets").doc(uid);
        const walletSnap = await transaction.get(walletRef);
        const wallet = walletSnap.data();
        const winningBalance = wallet.winningBalance || 0;
        if (winningBalance < amount)
            throw new functions.https.HttpsError("failed-precondition", "Insufficient winning balance");
        transaction.update(walletRef, {
            winningBalance: admin.firestore.FieldValue.increment(-amount)
        });
        const withdrawalRef = db.collection("withdrawals").doc();
        transaction.set(withdrawalRef, {
            userId: uid,
            amount,
            upiId,
            bankDetails,
            status: "PENDING",
            createdAt: admin.firestore.Timestamp.now()
        });
        return { success: true };
    });
});
exports.getReferralData = functions.https.onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists)
        throw new functions.https.HttpsError("not-found", "User not found");
    const userData = userSnap.data();
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
exports.claimReferralEarnings = functions.https.onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    return db.runTransaction(async (transaction) => {
        const walletRef = db.collection("wallets").doc(uid);
        const walletSnap = await transaction.get(walletRef);
        const wallet = walletSnap.data();
        const referralBalance = wallet.referralBalance || 0;
        if (referralBalance <= 0)
            throw new functions.https.HttpsError("failed-precondition", "No balance to claim");
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
exports.getAdminData = functions.https.onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    const adminSnap = await db.collection("users").doc(uid).get();
    if (adminSnap.data()?.role !== "ADMIN")
        throw new functions.https.HttpsError("permission-denied", "Admin only");
    const [usersSnap, paymentsSnap, betsSnap, txSnap] = await Promise.all([
        db.collection("users").limit(100).get(),
        db.collection("withdrawals").where("status", "==", "PENDING").limit(50).get(),
        db.collection("bets").where("status", "==", "PENDING").limit(50).get(),
        db.collection("transactions").orderBy("createdAt", "desc").limit(50).get()
    ]);
    const users = usersSnap.docs.map(doc => ({
        _id: doc.id,
        ...doc.data()
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
    const metrics = {
        totalUsers: users.length,
        totalVolume: transactions.reduce((acc, tx) => acc + (tx.type === "DEPOSIT" ? tx.amount : 0), 0),
        activeBets: liveBets.length,
        platformProfit: transactions.reduce((acc, tx) => acc + (tx.type === "GAME_LOSS" ? tx.amount : (tx.type === "GAME_WIN" ? -tx.amount : 0)), 0),
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
exports.createAdminUser = functions.https.onCall(async (request) => {
    const { userId, fullName, mobile, password, initialBalance } = request.data;
    const uid = request.auth?.uid;
    if (!uid)
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    try {
        const userRecord = await admin.auth().createUser({
            email: `${userId}@colortrade.app`,
            password: password,
            displayName: fullName,
            phoneNumber: mobile.startsWith("+") ? mobile : `+91${mobile}`
        });
        const newUserUid = userRecord.uid;
        const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await db.collection("users").doc(newUserUid).set({
            userId,
            fullName,
            phone: mobile,
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
    }
    catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});
exports.toggleUserStatus = functions.https.onCall(async (request) => {
    const { targetUid } = request.data;
    const uid = request.auth?.uid;
    if (!uid)
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    const userRef = db.collection("users").doc(targetUid);
    const userSnap = await userRef.get();
    const currentStatus = userSnap.data()?.isActive;
    await userRef.update({ isActive: !currentStatus });
    return { success: true, newState: !currentStatus };
});
exports.reviewPayment = functions.https.onCall(async (request) => {
    const { requestId, action } = request.data;
    const uid = request.auth?.uid;
    if (!uid)
        throw new functions.https.HttpsError("unauthenticated", "Login required");
    const withdrawRef = db.collection("withdrawals").doc(requestId);
    const withdrawSnap = await withdrawRef.get();
    const withdrawData = withdrawSnap.data();
    if (action === "APPROVE") {
        await withdrawRef.update({ status: "APPROVED", approvedAt: admin.firestore.Timestamp.now() });
    }
    else {
        const walletRef = db.collection("wallets").doc(withdrawData.userId);
        await db.runTransaction(async (transaction) => {
            transaction.update(walletRef, {
                winningBalance: admin.firestore.FieldValue.increment(withdrawData.amount)
            });
            transaction.update(withdrawRef, { status: "REJECTED", rejectedAt: admin.firestore.Timestamp.now() });
        });
    }
    return { success: true };
});
//# sourceMappingURL=index.js.map