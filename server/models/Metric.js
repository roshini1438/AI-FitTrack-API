const mongoose = require("mongoose");

const metricSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    weight: {
      type: Number,
      required: [true, "Weight (kg) is required"],
      min: [20, "Weight must be at least 20 kg"],
      max: [400, "Weight must be under 400 kg"],
    },
    height: { type: Number, min: [80, "Height must be at least 80 cm"], max: [260, "Height must be under 260 cm"] },
    note: { type: String, trim: true, default: "" },
    metricDate: { type: Date, required: [true, "Date is required"] },
  },
  { timestamps: true }
);

metricSchema.index({ user: 1, metricDate: -1 });

module.exports = mongoose.model("Metric", metricSchema);
