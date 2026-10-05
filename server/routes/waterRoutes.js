const express = require("express");
const { addWater, getWater, deleteWater } = require("../controllers/waterController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);
router.route("/").post(addWater).get(getWater);
router.route("/:id").delete(deleteWater);

module.exports = router;
