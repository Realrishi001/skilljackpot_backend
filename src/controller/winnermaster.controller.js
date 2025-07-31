import { tickets } from "../models/ticket.model.js";
import { winningNumbers } from "../models/winningNumbers.model.js";
import Admin from "../models/admins.model.js";

// Helper to get all two-digit combos as string
const getAllTwoDigit = () => Array.from({length: 100}, (_,i)=>i.toString().padStart(2,"0"));

// Generate a unique number not in usedNumbers for a given prefix
function getUniqueNumber(prefix, usedNumbers) {
  for (const last2 of getAllTwoDigit()) {
    const num = prefix + last2;
    if (!usedNumbers.has(num)) return num;
  }
  // fallback: return null if all are used
  return null;
}

export const getTodaysTicketNumbers = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Collect all today's ticket numbers (in 4-digit format)
    const allTickets = await tickets.findAll({
      attributes: ["ticketNumber", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    let usedNumbers = new Set();

    allTickets.forEach(ticket => {
      if (new Date(ticket.createdAt).toISOString().split("T")[0] !== today) return;

      let ticketStr = ticket.ticketNumber;
      if (typeof ticketStr !== "string") ticketStr = JSON.stringify(ticketStr);
      ticketStr = ticketStr.replace(/^"+|"+$/g, "");

      const pairs = ticketStr.split(",").map(pair => pair.trim());
      pairs.forEach(pair => {
        const [numPart] = pair.split(":").map(v => v.trim());
        if (numPart) usedNumbers.add(numPart.replace("-", ""));
      });
    });

    // Helper for series (takes prefix as string, e.g. "10", "30", "50")
    const generateSeries = (start) => {
      const series = [];
      for (let prefix = start; prefix < start + 10; prefix++) {
        const uniqueNum = getUniqueNumber(String(prefix), usedNumbers);
        if (uniqueNum) {
          series.push(uniqueNum);
          usedNumbers.add(uniqueNum);
        }
      }
      return series;
    };

    // Generate for all three series
    const series10 = generateSeries(10); // 10-19
    const series30 = generateSeries(30); // 30-39
    const series50 = generateSeries(50); // 50-59

    res.status(200).json({
      success: true,
      date: today,
      series10,
      series30,
      series50,
      count: {
        series10: series10.length,
        series30: series30.length,
        series50: series50.length,
      }
    });
  } catch (error) {
    console.error("Error generating unique numbers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate numbers",
      error: error.message,
    });
  }
};


export const saveWinningNumbers = async (req, res) => {
  try {
    // Get fields from req.body (excluding loginId!)
    const { winningNumbers: numbers, totalPoints, DrawTime, drawDate } = req.body;
    console.log(winningNumbers, totalPoints, drawDate, DrawTime);

    if (
      !numbers ||
      !Array.isArray(numbers) ||
      numbers.length === 0 ||
      totalPoints === undefined ||
      !DrawTime ||
      !drawDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid required fields. Required: winningNumbers (array), totalPoints, DrawTime, drawDate",
      });
    }

    // Get all admins (just their ids)
    const admins = await Admin.findAll({ attributes: ["id"] });

    if (!admins.length) {
      return res.status(404).json({ success: false, message: "No admins found." });
    }

    // Track results for each admin
    let results = [];
    for (const admin of admins) {
      const loginId = admin.id;

      // Check for existing record
      const existing = await winningNumbers.findOne({
        where: { loginId, DrawTime, drawDate },
      });

      let record, action;
      if (existing) {
        record = await existing.update({
          winningNumbers: numbers,
          totalPoints,
        });
        action = "updated";
      } else {
        record = await winningNumbers.create({
          loginId,
          winningNumbers: numbers,
          totalPoints,
          DrawTime,
          drawDate,
        });
        action = "created";
      }
      results.push({ loginId, action, data: record });
    }

    return res.status(200).json({
      success: true,
      message: "Winning numbers processed for all admins",
      results, // Contains one entry per admin, showing 'created' or 'updated'
    });
  } catch (error) {
    console.error("Error saving winning numbers for all admins:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while saving winning numbers for all admins",
      error: error.message,
    });
  }
};
