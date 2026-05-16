import { FraudEvent } from "../models/FraudEvent.js";
import { User } from "../models/User.js";

export async function scoreBetRequest(input: {
  userId: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  amount: number;
}) {
  let score = 0;
  const duplicateDeviceCount = input.deviceFingerprint
    ? await User.countDocuments({ "devices.fingerprint": input.deviceFingerprint })
    : 0;

  if (duplicateDeviceCount > 3) score += 30;
  if (input.amount > 50_000) score += 35;
  if (!input.deviceFingerprint || input.deviceFingerprint === "unknown") score += 15;

  const duplicateIpCount = input.ipAddress
    ? await User.countDocuments({ "devices.ipAddress": input.ipAddress, _id: { $ne: input.userId } })
    : 0;
  if (duplicateIpCount > 2) score += 25;

  if (score >= 50) {
    await FraudEvent.create({
      userId: input.userId,
      eventType: "BET_RISK_SCORE",
      severity: score >= 80 ? "CRITICAL" : "HIGH",
      score,
      evidence: input
    });
  }

  return { score, allowed: score < 80 };
}
