import { tickets } from "../models/ticket.model.js";
import Admin from "../models/admins.model.js";
import { winningPercentage } from "../models/winningPercentage.model.js";
import { winningNumbers } from "../models/winningNumbers.model.js";

// Helpers
function getPrefixList(seriesPrefix) {
  const start = parseInt(seriesPrefix);
  return Array.from({ length: 10 }, (_, i) => String(start + i));
}
function getRandomTwoDigits() {
  return String(Math.floor(Math.random() * 100)).padStart(2, '0');
}
function getSeries(numStr) {
  if (numStr.length < 4) return null;
  return numStr.slice(0, 2);
}

export const getTicketsByDrawTime = async (req, res) => {
  try {
    const { drawTime, adminId } = req.body;
    if (!drawTime || !adminId) {
      return res.status(400).json({ message: "drawTime and adminId are required" });
    }
    const currentDate = new Date().toISOString().split('T')[0];
    const queryTime = drawTime.trim().toLowerCase();

    // Check if results already exist
    const existingResult = await winningNumbers.findOne({
      where: {
        DrawTime: drawTime,
        drawDate: currentDate,
        loginId: adminId
      }
    });

    if (existingResult) {
      // Parse winning numbers JSON if stored as string
      const storedNumbers =
        typeof existingResult.winningNumbers === "string"
          ? JSON.parse(existingResult.winningNumbers)
          : existingResult.winningNumbers;

      // Group stored numbers by series
      const seriesSelected = { "10": [], "30": [], "50": [] };
      storedNumbers.forEach(entry => {
        const prefix = getSeries(entry.number);
        if (seriesSelected[prefix]) seriesSelected[prefix].push(entry);
      });

      return res.status(200).json({
        message: `Result already declared for draw time "${drawTime}" on ${currentDate}.`,
        drawTime,
        totalPoints: existingResult.totalPoints,
        commission: null,
        winningPercentage: null,
        updatedTotalPoint: null,
        selectedTickets: storedNumbers,
        sumOfSelected: storedNumbers.reduce((sum, t) => sum + Number(t.value), 0),
        numbersBySeries: seriesSelected
      });
    }

    // --- FETCH ALL TICKETS ---
    const allTickets = await tickets.findAll({
      where: { /* optionally filter more */ },
      attributes: ["ticketNumber", "drawTime", "loginId"],
    });

    // --- FILTER TICKETS FOR DRAW TIME & ADMIN ---
    const filtered = allTickets.filter(ticket => {
      // Match by loginId
      if (String(ticket.loginId) !== String(adminId)) return false;
      // Match by drawTime
      let times;
      try {
        times = Array.isArray(ticket.drawTime)
          ? ticket.drawTime
          : JSON.parse(ticket.drawTime);
      } catch (e) {
        return false;
      }
      if (!Array.isArray(times)) return false;
      return times.map(t => String(t).trim().toLowerCase()).includes(queryTime);
    });

    // --- PARSE AND AGGREGATE TICKET QUANTITIES ---
    // ticketNumber format: "50-2-2 : 5"
    // We want a map: { "5022": totalQuantity }
    const ticketQuantityMap = {};
    filtered.forEach(ticket => {
      const parts = (ticket.ticketNumber || "").split(",");
      parts.forEach(part => {
        let [num, qty] = part.split(":").map(s => s.trim());
        if (num && qty && !isNaN(qty)) {
          // Normalize ticket number (remove dashes)
          const normalizedNum = num.replace(/-/g, "");
          ticketQuantityMap[normalizedNum] = (ticketQuantityMap[normalizedNum] || 0) + Number(qty);
        }
      });
    });

    // --- GET ADMIN COMMISSION ---
    const admin = await Admin.findByPk(adminId, { attributes: ["commission"] });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    // --- CALCULATE TOTAL QUANTITY & POINTS ---
    const totalQuantity = Object.values(ticketQuantityMap).reduce((sum, qty) => sum + qty, 0);
    const totalPoints = totalQuantity * 180;

    // --- COMMISSION & WINNING PERCENTAGE ---
    const commissionPercent = Number(admin.commission) || 0;
    const afterCommission = totalPoints - (totalPoints * commissionPercent / 100);
    const latestWinning = await winningPercentage.findOne({ order: [['createdAt', 'DESC']] });
    const winningPercent = latestWinning ? Number(latestWinning.percentage) : 0;
    const updatedTotalPoint = Math.floor(afterCommission * (winningPercent / 100));

    // --- SELECT WINNERS (UP TO PRIZE POOL) ---
    // Prepare all ticket entries sorted by highest quantity
    const allTicketEntries = Object.entries(ticketQuantityMap)
      .map(([number, qty]) => ({ number, qty, value: qty * 180 }))
      .sort((a, b) => b.value - a.value); // highest value first

    // Prepare winner selection logic
    let prizeDistributed = 0;
    const winners = [];
    const seriesPrefixes = ["10", "30", "50"];
    const numbersBySeries = { "10": [], "30": [], "50": [] };

    // For each series, go from prefix0 to prefix9
    for (const prefix of seriesPrefixes) {
      const prefixList = getPrefixList(prefix);
      for (const pfx of prefixList) {
        // Find tickets for this prefix
        const candidates = allTicketEntries.filter(entry => entry.number.startsWith(pfx));
        if (candidates.length > 0) {
          for (const entry of candidates) {
            if (prizeDistributed + entry.value > updatedTotalPoint) continue; // Don't exceed prize pool
            winners.push({ number: entry.number, value: entry.value });
            numbersBySeries[prefix].push({ number: entry.number, value: entry.value });
            prizeDistributed += entry.value;
            break; // Only pick one per prefix
          }
        } else {
          // No real ticket for this prefix, fill with random (value=0)
          const randomNum = pfx + getRandomTwoDigits();
          winners.push({ number: randomNum, value: 0 });
          numbersBySeries[prefix].push({ number: randomNum, value: 0 });
        }
        // Stop if prize pool limit reached/exceeded
        if (prizeDistributed >= updatedTotalPoint) break;
      }
      if (prizeDistributed >= updatedTotalPoint) break;
    }

    // --- SAVE WINNING NUMBERS ---
    await winningNumbers.create({
      loginId: adminId,
      winningNumbers: winners,
      totalPoints,
      DrawTime: drawTime,
      drawDate: currentDate
    });

    return res.status(200).json({
      drawTime,
      totalPoints,
      commission: commissionPercent,
      winningPercentage: winningPercent,
      updatedTotalPoint,
      selectedTickets: winners,
      sumOfSelected: prizeDistributed,
      numbersBySeries
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};



export const getWinningNumbersByLoginId = async (req, res) => {
  try {
    const { loginId } = req.body;
    if (!loginId) {
      return res.status(400).json({ message: "loginId is required" });
    }

    // Find all winning numbers for this loginId
    const records = await winningNumbers.findAll({
      where: { loginId },
      attributes: ["winningNumbers", "DrawTime", "drawDate"],
      order: [["drawDate", "DESC"], ["createdAt", "DESC"]], // latest first
    });

    return res.status(200).json({ count: records.length, results: records });
  } catch (err) {
    console.error("Error fetching winning numbers:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
