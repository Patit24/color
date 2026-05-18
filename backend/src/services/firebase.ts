import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firestore: admin.firestore.Firestore | null = null;

try {
  // Check if local service account file exists (search both backend and root workspace)
  const rootKeyPath = path.resolve(__dirname, "../../../firebase-service-account.json");
  const localKeyPath = path.resolve(__dirname, "../../firebase-service-account.json");
  let credential = admin.credential.applicationDefault();

  if (fs.existsSync(rootKeyPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(rootKeyPath, "utf-8"));
    credential = admin.credential.cert(serviceAccount);
    console.log("Initializing Firebase Admin with service account key found at workspace root");
  } else if (fs.existsSync(localKeyPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, "utf-8"));
    credential = admin.credential.cert(serviceAccount);
    console.log("Initializing Firebase Admin with service account key found at backend root");
  }

  admin.initializeApp({
    credential,
    projectId: "color-trade-4a76f"
  });
  firestore = admin.firestore();
  console.log("Firebase Admin successfully initialized inside backend");
} catch (error: any) {
  console.warn("Firebase Admin failed to initialize. Falling back to MongoDB local wallet storage only.", error.message);
}

export type FirestoreWallet = {
  depositBalance: number;
  winningBalance: number;
  bonusBalance: number;
};

export async function getFirestoreWallet(firebaseUid: string): Promise<FirestoreWallet | null> {
  if (!firestore) return null;
  try {
    const docRef = firestore.collection("wallets").doc(firebaseUid);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data() || {};
      return {
        depositBalance: Number(data.depositBalance || 0),
        winningBalance: Number(data.winningBalance || 0),
        bonusBalance: Number(data.bonusBalance || 0),
      };
    } else {
      // If it doesn't exist, create it in Firestore
      const newWallet = { depositBalance: 0, winningBalance: 0, bonusBalance: 0 };
      await docRef.set(newWallet);
      return newWallet;
    }
  } catch (error: any) {
    console.warn(`Failed to fetch Firestore wallet for ${firebaseUid}:`, error.message);
  }
  return null;
}

export async function updateFirestoreWallet(
  firebaseUid: string,
  update: { depositBalance?: number; winningBalance?: number; bonusBalance?: number }
): Promise<boolean> {
  if (!firestore) return false;
  try {
    const docRef = firestore.collection("wallets").doc(firebaseUid);
    await docRef.set(update, { merge: true });
    return true;
  } catch (error: any) {
    console.warn(`Failed to update Firestore wallet for ${firebaseUid}:`, error.message);
    return false;
  }
}

export async function createFirestoreTransaction(
  firebaseUid: string,
  transaction: { type: string; amount: number; status: string }
): Promise<boolean> {
  if (!firestore) return false;
  try {
    await firestore.collection("transactions").add({
      userId: firebaseUid,
      type: transaction.type,
      amount: transaction.amount,
      status: transaction.status,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error: any) {
    console.warn(`Failed to create Firestore transaction for ${firebaseUid}:`, error.message);
    return false;
  }
}

export async function createFirestoreBet(
  firebaseUid: string,
  bet: { period: string; selection: string; amount: number; status: string; profit: number }
): Promise<boolean> {
  if (!firestore) return false;
  try {
    await firestore.collection("bets").add({
      userId: firebaseUid,
      period: bet.period,
      selection: bet.selection,
      amount: bet.amount,
      status: bet.status,
      winAmount: bet.profit,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (error: any) {
    console.warn(`Failed to create Firestore bet for ${firebaseUid}:`, error.message);
    return false;
  }
}

export async function updateFirestoreBet(
  firebaseUid: string,
  period: string,
  update: { status: string; profit: number }
): Promise<boolean> {
  if (!firestore) return false;
  try {
    const q = await firestore.collection("bets")
      .where("userId", "==", firebaseUid)
      .where("period", "==", period)
      .limit(1)
      .get();
    
    if (!q.empty) {
      const docId = q.docs[0].id;
      await firestore.collection("bets").doc(docId).update({
        status: update.status,
        winAmount: update.profit,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return true;
    }
    return false;
  } catch (error: any) {
    console.warn(`Failed to update Firestore bet for ${firebaseUid}:`, error.message);
    return false;
  }
}
