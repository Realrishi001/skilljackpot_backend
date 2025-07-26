import { tickets } from "../models/ticket.model.js";
import Admin from "../models/admins.model.js";
import { winningPercentage } from "../models/winningPercentage.model.js";

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Helpers to fill empty slots in each series
function getRange(min, max) {
  const arr = [];
  for (let i = min; i <= max; i++) arr.push(i.toString());
  return arr;
}
function getRandomFromRange(rangeArr, count, excludeList = []) {
  const available = rangeArr.filter(x => !excludeList.includes(x));
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, count);
}
function getSeries(numStr) {
  if (numStr.length < 4) return null;
  return numStr.slice(0, 2); // e.g., "50"
}

export const getTicketsByDrawTime = async (req, res) => {
  try {
    const { drawTime, adminId } = req.body;
    if (!drawTime || !adminId) {
      return res.status(400).json({ message: "drawTime and adminId are required" });
    }

    const queryTime = drawTime.trim().toLowerCase();

    // Fetch all tickets
    const allTickets = await tickets.findAll({
      attributes: ["ticketNumber", "totalPoints", "drawTime"]
    });

    // Filter tickets by drawTime
    const filtered = allTickets.filter(ticket => {
      if (!ticket.drawTime) return false;
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

    // Fetch admin and their commission
    const admin = await Admin.findByPk(adminId, { attributes: ["commission"] });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    // If no tickets for the drawTime, return random numbers in each series
    if (!filtered.length) {
      const fill10 = getRandomFromRange(getRange(1000, 1999), 10).map(n => ({ number: n, value: 0 }));
      const fill30 = getRandomFromRange(getRange(3000, 3999), 10).map(n => ({ number: n, value: 0 }));
      const fill50 = getRandomFromRange(getRange(5000, 5999), 10).map(n => ({ number: n, value: 0 }));
      return res.status(200).json({
        drawTime,
        totalPoints: 0,
        commission: Number(admin.commission),
        winningPercentage: 0,
        updatedTotalPoint: 0,
        selectedTickets: [...fill10, ...fill30, ...fill50],
        sumOfSelected: 0,
        numbersBySeries: {
          "10": fill10,
          "30": fill30,
          "50": fill50,
        }
      });
    }

    // Deduplicate and sum values by ticket number
    const ticketMap = {}; // { '5070': value }
    filtered.forEach(ticket => {
      let ticketStr = ticket.ticketNumber;
      if (typeof ticketStr === "string" && ticketStr.startsWith('"') && ticketStr.endsWith('"')) {
        ticketStr = ticketStr.slice(1, -1);
      }
      const parts = ticketStr.split(",").map(p => p.trim()).filter(Boolean);
      parts.forEach(part => {
        const [num, val] = part.split(":").map(s => s.trim());
        if (num && val && !isNaN(val)) {
          const numericNum = num.replace(/-/g, ""); // Remove dash, e.g. "50-70" -> "5070"
          ticketMap[numericNum] = (ticketMap[numericNum] || 0) + Number(val);
        }
      });
    });

    // Convert deduplicated map to array
    const allTicketEntries = Object.entries(ticketMap).map(([number, value]) => ({
      number,
      value,
    }));

    // --- GROUP BY SERIES ---
    const seriesMap = { "10": [], "30": [], "50": [] };
    allTicketEntries.forEach(entry => {
      const prefix = getSeries(entry.number);
      if (seriesMap[prefix]) {
        seriesMap[prefix].push(entry);
      }
    });

    // Shuffle each series
    Object.keys(seriesMap).forEach(series => shuffleArray(seriesMap[series]));

    // Commission calculation
    const totalPoints = filtered.reduce(
      (sum, ticket) => sum + Number(ticket.totalPoints),
      0
    );
    const commissionPercent = Number(admin.commission) || 0;
    const afterCommission = totalPoints - (totalPoints * commissionPercent / 100);

    // Fetch the latest winning percentage
    const latestWinning = await winningPercentage.findOne({
      order: [['createdAt', 'DESC']]
    });
    const winningPercent = latestWinning ? Number(latestWinning.percentage) : 0;
    const updatedTotalPoint = Math.round(afterCommission * (winningPercent / 100));

    // --- SELECT 10 NUMBERS FROM EACH SERIES, WITHOUT EXCEEDING THE TOTAL ---
    let runningSum = 0;
    let selectedTickets = [];
    const perSeriesLimit = 10;
    let seriesSelected = { "10": [], "30": [], "50": [] };

    // 1st pass: Pick real ticket numbers (sum does not exceed updatedTotalPoint)
    for (const series of ["10", "30", "50"]) {
      for (const entry of seriesMap[series]) {
        if (seriesSelected[series].length >= perSeriesLimit) break;
        if (runningSum + entry.value > updatedTotalPoint) break;
        seriesSelected[series].push(entry);
        runningSum += entry.value;
      }
    }

    // 2nd pass: If less than 10 in a series, fill with randoms from that range (value: 0)
    if (seriesSelected["10"].length < 10) {
      const already = seriesSelected["10"].map(e => e.number);
      const fill10 = getRandomFromRange(getRange(1000, 1999), 10 - already.length, already)
        .map(n => ({ number: n, value: 0 }));
      seriesSelected["10"] = [...seriesSelected["10"], ...fill10];
    }
    if (seriesSelected["30"].length < 10) {
      const already = seriesSelected["30"].map(e => e.number);
      const fill30 = getRandomFromRange(getRange(3000, 3999), 10 - already.length, already)
        .map(n => ({ number: n, value: 0 }));
      seriesSelected["30"] = [...seriesSelected["30"], ...fill30];
    }
    if (seriesSelected["50"].length < 10) {
      const already = seriesSelected["50"].map(e => e.number);
      const fill50 = getRandomFromRange(getRange(5000, 5999), 10 - already.length, already)
        .map(n => ({ number: n, value: 0 }));
      seriesSelected["50"] = [...seriesSelected["50"], ...fill50];
    }

    // Final result: Each series has exactly 10, randoms (value 0) if needed
    selectedTickets = [...seriesSelected["10"], ...seriesSelected["30"], ...seriesSelected["50"]];

    return res.status(200).json({
      drawTime,
      totalPoints,
      commission: commissionPercent,
      winningPercentage: winningPercent,
      updatedTotalPoint,
      selectedTickets,
      sumOfSelected: runningSum,
      numbersBySeries: {
        "10": seriesSelected["10"],
        "30": seriesSelected["30"],
        "50": seriesSelected["50"],
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
