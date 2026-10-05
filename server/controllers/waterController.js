const Water = require("../models/Water");

/** @route POST /api/water  @desc Log a glass/bottle of water  @access Private */
const addWater = async (req, res, next) => {
  try {
    const { amount, waterDate } = req.body;
    const entry = await Water.create({ user: req.user._id, amount, waterDate });
    res.status(201).json({ success: true, message: "Water logged", data: { entry } });
  } catch (error) {
    next(error);
  }
};

/** @route GET /api/water  @desc Latest 100 entries, newest first  @access Private */
const getWater = async (req, res, next) => {
  try {
    const entries = await Water.find({ user: req.user._id }).sort({ waterDate: -1, createdAt: -1 }).limit(100);
    res.status(200).json({ success: true, count: entries.length, data: { entries } });
  } catch (error) {
    next(error);
  }
};

/** @route DELETE /api/water/:id  @access Private */
const deleteWater = async (req, res, next) => {
  try {
    const entry = await Water.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!entry) return res.status(404).json({ success: false, message: "Water entry not found" });
    res.status(200).json({ success: true, message: "Water entry deleted" });
  } catch (error) {
    next(error);
  }
};

module.exports = { addWater, getWater, deleteWater };
