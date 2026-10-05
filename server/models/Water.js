const mongoose = require("mongoose");

const waterSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: {
      type: Number,
      required: [true, "Amount (ml) is required"],
      min: [1, "Amount must be at least 1 ml"],
      max: [5000, "Amount must be 5000 ml or less"],
    },
    waterDate: { type: Date, required: [true, "Date is required"] },
  },
  { timestamps: true }
);

waterSchema.index({ user: 1, waterDate: -1 });

module.exports = mongoose.model("Water", waterSchema);
