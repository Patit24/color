import bcrypt from "bcryptjs";
import { connectMongo } from "../config/db.js";
import { Admin } from "../models/Admin.js";

const email = process.env.ADMIN_EMAIL?.toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME || "Super Admin";

if (!email || !password) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
}

await connectMongo();

const passwordHash = await bcrypt.hash(password, 12);
await Admin.findOneAndUpdate(
  { email },
  {
    name,
    email,
    password: passwordHash,
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
    isActive: true
  },
  { upsert: true, new: true }
);

console.log(`Admin ready: ${email}`);
process.exit(0);
