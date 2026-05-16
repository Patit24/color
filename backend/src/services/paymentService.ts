import crypto from "node:crypto";
import Razorpay from "razorpay";
import { env } from "../config/env.js";
import { PaymentRequest } from "../models/PaymentRequest.js";

function razorpayClient() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials are not configured");
  }

  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET
  });
}

export async function createRazorpayDeposit(userId: string, amount: number) {
  const request = await PaymentRequest.create({
    userId,
    type: "DEPOSIT",
    method: "RAZORPAY",
    amount,
    status: "PENDING"
  });

  const order = await razorpayClient().orders.create({
    amount: amount * 100,
    currency: "INR",
    receipt: String(request._id),
    notes: { userId }
  });

  request.providerReference = order.id;
  request.metadata = order;
  await request.save();
  return { request, order };
}

export function verifyRazorpaySignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  if (!env.RAZORPAY_KEY_SECRET) throw new Error("Razorpay secret missing");
  const body = `${input.orderId}|${input.paymentId}`;
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");
  return expected === input.signature;
}

export async function createCryptoDeposit(userId: string, amount: number, network: string) {
  if (!env.CRYPTO_DEPOSIT_WALLET) throw new Error("Crypto deposit wallet not configured");
  const request = await PaymentRequest.create({
    userId,
    type: "DEPOSIT",
    method: "CRYPTO",
    amount,
    status: "PENDING",
    payoutAddress: env.CRYPTO_DEPOSIT_WALLET,
    metadata: { network }
  });

  return {
    request,
    depositAddress: env.CRYPTO_DEPOSIT_WALLET,
    network
  };
}
