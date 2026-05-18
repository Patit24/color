import mongoose from "mongoose";
import { connectMongo } from "../config/db.js";
import { User } from "../models/User.js";
import { Wallet } from "../models/Wallet.js";
import { SlotSpin } from "../models/SlotSpin.js";
import { JackpotSpin } from "../models/JackpotSpin.js";
import { executeSpin } from "../services/slotEngine.js";
import { executeJackpotSpin } from "../services/jackpotEngine.js";

async function runTest() {
  console.log("🚀 Starting Slot Payout Rule Verification Script...\n");

  // Connect to database
  await connectMongo();
  console.log("✅ Successfully connected to database.");

  // Clean up any old test users
  const email = "payout-tester@example.com";
  await User.deleteOne({ email });
  console.log("🧹 Cleaned up existing test accounts.");

  // 1. Create a brand new user
  const referralCode = "TEST" + Math.floor(1000 + Math.random() * 9000);
  const user = await User.create({
    fullName: "Payout Test User",
    email,
    referralCode,
    role: "real_user",
    accountType: "REAL",
    status: "ACTIVE",
    isActive: true,
  });
  console.log(`👤 Created fresh user. ID: ${user._id}, Referral: ${referralCode}`);

  // Create Wallet and initialize balance to ₹100
  let wallet = await Wallet.create({
    userId: user._id,
    depositBalance: 100,
    winningBalance: 0,
    bonusBalance: 0
  });
  console.log(`💰 Created wallet with balance: ₹100`);

  // Helper to print wallet status
  async function showWallet() {
    const w = await Wallet.findOne({ userId: user._id });
    if (w) {
      console.log(`💵 Current Wallet Balance: deposit: ₹${w.depositBalance}, winning: ₹${w.winningBalance}, bonus: ₹${w.bonusBalance}`);
    }
  }

  // Helper to clear spins to mock spin counts
  async function clearSpinRecords() {
    await SlotSpin.deleteMany({ userId: user._id });
    await JackpotSpin.deleteMany({ userId: user._id });
  }

  console.log("\n--------------------------------------------------");
  console.log("🌟 TEST CASE 1: New Account Welcome Reward (within first 3-4 spins, e.g. totalSpins === 1)");
  console.log("--------------------------------------------------");

  // Spin 1: totalSpins overall is 0 (isSpecialSpin = false, new user reward triggered = false)
  console.log("👉 Performing spin 1 (totalSpins overall: 0)...");
  let res1 = await executeSpin(String(user._id), 2, "dummy-fingerprint", "127.0.0.1");
  console.log(`   🎰 Spin 1 Result -> Paylines: ${res1.paylines.length}, Win: ₹${res1.totalWin}`);
  await showWallet();

  // Spin 2: totalSpins overall is 1 (isNewUserRewardSpin = true)
  console.log("👉 Performing spin 2 (totalSpins overall: 1 - should trigger new user reward ₹20–₹50)...");
  let res2 = await executeSpin(String(user._id), 2, "dummy-fingerprint", "127.0.0.1");
  console.log(`   🎰 Spin 2 Result -> Paylines: ${res2.paylines.length}, Win: ₹${res2.totalWin}`);
  if (res2.totalWin >= 20 && res2.totalWin <= 50) {
    console.log("   🎉 SUCCESS: New user welcome reward successfully triggered and returned win within ₹20–₹50!");
  } else {
    console.error(`   ❌ FAILURE: Welcome reward returned invalid win of ₹${res2.totalWin}`);
  }
  await showWallet();

  // Verify DB flags
  const u1 = await User.findById(user._id);
  console.log(`   🏷️  New User Reward Triggered flag in DB: ${u1?.newUserRewardTriggered}`);

  console.log("\n--------------------------------------------------");
  console.log("🌟 TEST CASE 2: Near Bankruptcy Saver (balance is low & recovery not triggered yet)");
  console.log("--------------------------------------------------");

  // Set balance to a low value (e.g. ₹5)
  await Wallet.findOneAndUpdate({ userId: user._id }, { depositBalance: 5, winningBalance: 0, bonusBalance: 0 });
  console.log("⚙️  Set balance to ₹5 (about to end).");
  await showWallet();

  // Spin: should trigger bankruptcy saver (win of ₹80–₹150)
  console.log("👉 Performing spin with near bankruptcy balance...");
  let resBankruptcy = await executeSpin(String(user._id), 2, "dummy-fingerprint", "127.0.0.1");
  console.log(`   🎰 Bankruptcy Spin Result -> Paylines: ${resBankruptcy.paylines.length}, Win: ₹${resBankruptcy.totalWin}`);
  if (resBankruptcy.totalWin >= 80 && resBankruptcy.totalWin <= 150) {
    console.log("   🎉 SUCCESS: Near bankruptcy saver successfully triggered and returned win within ₹80–₹150!");
  } else {
    console.error(`   ❌ FAILURE: Bankruptcy saver returned invalid win of ₹${resBankruptcy.totalWin}`);
  }
  await showWallet();

  // Verify DB flags
  const u2 = await User.findById(user._id);
  console.log(`   🏷️  Bankruptcy Recovery Triggered flag in DB: ${u2?.bankruptcyRecoveryTriggered}`);

  console.log("\n--------------------------------------------------");
  console.log("🌟 TEST CASE 3: Mega 2000 Spin (every 2000 spins overall gets ₹800–₹1000 win)");
  console.log("--------------------------------------------------");

  // Mock spin count to 1999 spins by creating dummy records in DB
  console.log("⚙️  Mocking 1999 spin records for user to simulate the 2000th spin...");
  await clearSpinRecords();
  const dummySpins = Array.from({ length: 1999 }, (_, i) => ({
    userId: user._id,
    betAmount: 2,
    reels: [["lemon", "lemon", "lemon"], ["lemon", "lemon", "lemon"], ["lemon", "lemon", "lemon"]],
    paylines: [],
    totalWin: 0,
    profit: -2,
    isJackpot: false,
    multiplier: 0,
    seedHash: "dummy",
    deviceFingerprint: "dummy",
    ipAddress: "127.0.0.1"
  }));
  await SlotSpin.insertMany(dummySpins);
  console.log("✅ Created 1999 dummy spins.");

  // Reset wallet balance so we have enough funds
  await Wallet.findOneAndUpdate({ userId: user._id }, { depositBalance: 100, winningBalance: 0, bonusBalance: 0 });

  // 2000th spin overall: should trigger mega win ₹800–₹1000
  console.log("👉 Performing 2000th spin...");
  let resMega = await executeSpin(String(user._id), 2, "dummy-fingerprint", "127.0.0.1");
  console.log(`   🎰 2000th Spin Result -> Paylines: ${resMega.paylines.length}, Win: ₹${resMega.totalWin}`);
  if (resMega.totalWin >= 800 && resMega.totalWin <= 1000) {
    console.log("   🎉 SUCCESS: Mega 2000 spin successfully triggered and returned win within ₹800–₹1000!");
  } else {
    console.error(`   ❌ FAILURE: Mega spin returned invalid win of ₹${resMega.totalWin}`);
  }
  await showWallet();

  console.log("\n--------------------------------------------------");
  console.log("🌟 TEST CASE 4: Jackpot Slots Integration");
  console.log("--------------------------------------------------");

  // Test Jackpot spin is also functioning perfectly
  console.log("👉 Performing a Jackpot Slot Spin...");
  let resJackpot = await executeJackpotSpin(String(user._id), 2, "dummy-fingerprint", "127.0.0.1");
  console.log(`   🎰 Jackpot Slot Result -> Paylines: ${resJackpot.paylines.length}, Win: ₹${resJackpot.totalWin}, Jackpot type: ${resJackpot.jackpotType}`);
  await showWallet();

  // Clean up
  await User.deleteOne({ email });
  await clearSpinRecords();
  await Wallet.deleteOne({ userId: user._id });
  console.log("\n🧹 Cleaned up all test data successfully.");

  console.log("\n🏁 All Verification Test Cases Completed!");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("❌ Test script failed with error:", err);
  process.exit(1);
});
