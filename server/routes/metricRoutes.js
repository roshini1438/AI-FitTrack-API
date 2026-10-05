const express = require("express");
const { addMetric, getMetrics, deleteMetric } = require("../controllers/metricController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);
router.route("/").post(addMetric).get(getMetrics);
router.route("/:id").delete(deleteMetric);

module.exports = router;
