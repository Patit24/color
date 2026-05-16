import { Schema, model, Types } from "mongoose";

const notificationSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    channel: { type: String, enum: ["APP", "PUSH", "SMS", "TELEGRAM"], default: "APP" },
    readAt: { type: Date }
  },
  { timestamps: true }
);

export const Notification = model("Notification", notificationSchema);
