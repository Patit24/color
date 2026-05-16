import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin.js";
import { User } from "../models/User.js";
import { Wallet } from "../models/Wallet.js";
import { env } from "../config/env.js";

export async function seedDefaultAccounts() {
  const adminCount = await Admin.countDocuments();
  if (adminCount === 0) {
    await Admin.create({
      name: "Super Admin",
      adminId: "superadmin",
      email: "superadmin",
      password: await bcrypt.hash("Admin@12345", 12),
      role: "super_admin",
      permissions: [
        "manage_users",
        "manage_games",
        "manage_payments",
        "manage_wallets",
        "view_analytics",
        "manage_bonuses",
        "send_notifications",
        "view_fraud"
      ],
      isActive: true,
      passwordChangeRequired: true
    });
    console.log("Default super admin created: superadmin / Admin@12345");
  } else {
    await Admin.updateOne(
      { email: "superadmin", adminId: { $exists: false } },
      { $set: { adminId: "superadmin" } }
    );
  }

  if (env.NODE_ENV === "production") {
    const demo = await User.findOne({ userId: "demouser" });
    if (demo) {
      await Wallet.deleteOne({ userId: demo._id });
      await User.deleteOne({ _id: demo._id });
      console.log("Development demo user removed for production mode");
    }
    return;
  }

  const demoUser = await User.findOneAndUpdate(
    { userId: "demouser" },
    {
      userId: "demouser",
      fullName: "Demo User",
      name: "Demo User",
      passwordHash: await bcrypt.hash("Demo@123", 12),
      referralCode: "DEMOUSER",
      role: "demo_user",
      accountType: "DEMO",
      status: "ACTIVE",
      isActive: true
    },
    { upsert: true, new: true }
  );

  await Wallet.findOneAndUpdate(
    { userId: demoUser._id },
    {
      userId: demoUser._id,
      depositBalance: 10000,
      winningBalance: 0,
      bonusBalance: 0,
      referralBalance: 0,
      withdrawableBalance: 0
    },
    { upsert: true, new: true }
  );
}
