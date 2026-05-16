import { Schema, model, Types } from "mongoose";

const adminLogSchema = new Schema(
  {
    adminId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String }
  },
  { timestamps: true }
);

export const AdminLog = model("AdminLog", adminLogSchema);
