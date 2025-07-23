import { winningPercentage } from "../models/winningPercentage.model.js";

// Update or create the global winning percentage
const setWinningPercentage = async (req, res) => {
  try {
    const { percentage } = req.body;
    if (typeof percentage !== "number" || percentage < 0 || percentage > 100) {
      return res.status(400).json({ message: "Invalid percentage value" });
    }

    // Try to find existing record
    let wp = await winningPercentage.findOne();

    if (wp) {
      wp.percentage = percentage;
      await wp.save();
    } else {
      wp = await winningPercentage.create({ percentage });
    }

    return res.status(200).json({
      message: "Winning percentage updated",
      percentage: wp.percentage,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Get the current winning percentage
const getWinningPercentage = async (req, res) => {
  try {
    const wp = await winningPercentage.findOne();
    if (!wp) {
      return res.status(404).json({ message: "Winning percentage not set" });
    }
    return res.status(200).json({ percentage: wp.percentage });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server Error" });
  }
};

export { setWinningPercentage, getWinningPercentage };
