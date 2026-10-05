const Metric = require("../models/Metric");

/** @route POST /api/metrics  @desc Log a body-metric entry  @access Private */
const addMetric = async (req, res, next) => {
  try {
    const { weight, height, note, metricDate } = req.body;
    const metric = await Metric.create({ user: req.user._id, weight, height, note, metricDate });
    res.status(201).json({ success: true, message: "Metric added successfully", data: { metric } });
  } catch (error) {
    next(error);
  }
};

/** @route GET /api/metrics  @desc All of the user's entries, newest first  @access Private */
const getMetrics = async (req, res, next) => {
  try {
    const metrics = await Metric.find({ user: req.user._id }).sort({ metricDate: -1 });
    res.status(200).json({ success: true, count: metrics.length, data: { metrics } });
  } catch (error) {
    next(error);
  }
};

/** @route DELETE /api/metrics/:id  @access Private */
const deleteMetric = async (req, res, next) => {
  try {
    const metric = await Metric.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!metric) return res.status(404).json({ success: false, message: "Metric entry not found" });
    res.status(200).json({ success: true, message: "Metric deleted successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = { addMetric, getMetrics, deleteMetric };
