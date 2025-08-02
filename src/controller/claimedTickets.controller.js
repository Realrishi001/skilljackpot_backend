import { tickets } from "../models/ticket.model.js";
import { winningNumbers } from "../models/winningNumbers.model.js";
import { claimedTickets } from "../models/claimedTickets.model.js";
import { Op } from "sequelize";

// Helper: Extract date from datetime string (e.g., "27-07-2025 11:34:24" => "27-07-2025")
function extractDate(datetimeStr) {
  return typeof datetimeStr === "string" ? datetimeStr.split(" ")[0] : "";
}

// Helper: "30-00 : 3" => {ticketNumber: "3000", quantity: 3}
function extractTicketNumberAndQuantity(str) {
  if (!str) return {};
  const [numPart, qtyPart] = str.split(":").map(s => s.trim());
  return {
    ticketNumber: numPart ? numPart.replace("-", "") : "",
    quantity: qtyPart ? parseInt(qtyPart, 10) : 0
  };
}

// Helper: "30-00 : 3, 30-11 : 4" => [{ticketNumber: "3000", quantity: 3}, ...]
function parseTicketNumberString(ticketNumberStr) {
  if (!ticketNumberStr) return [];
  if (typeof ticketNumberStr !== "string") ticketNumberStr = String(ticketNumberStr);
  return ticketNumberStr.split(",").map(extractTicketNumberAndQuantity);
}

// Helper: Remove leading zero from hour: "08:45 PM" => "8:45 PM"
function normalizeDrawTime(str) {
  if (!str) return "";
  return str.replace(/^0(\d:)/, "$1");
}

// Helper: Robust extraction of ticket numbers array
function extractTicketNumbers(ticketNumbersArr) {
  if (!ticketNumbersArr) return [];
  if (typeof ticketNumbersArr === "string") {
    try {
      const arr = JSON.parse(ticketNumbersArr);
      if (Array.isArray(arr)) ticketNumbersArr = arr;
      else return [ticketNumbersArr];
    } catch {
      // fallback: comma separated string
      return ticketNumbersArr.split(",").map(str => str.trim());
    }
  }
  if (!Array.isArray(ticketNumbersArr)) return [];
  // Array of objects: get ticketNumber or number
  return ticketNumbersArr.map(obj =>
    obj.ticketNumber || obj.number || (typeof obj === "string" ? obj : "")
  ).filter(Boolean);
}

// Helper: Sum quantity (quantity > winningValue > fallback 1)
function getTotalQuantity(ticketNumbersArr) {
  if (!Array.isArray(ticketNumbersArr)) return 0;
  return ticketNumbersArr.reduce((sum, t) => {
    if (t.quantity !== undefined) return sum + Number(t.quantity || 0);
    if (t.winningValue !== undefined) return sum + Number(t.winningValue || 0);
    return sum + 1;
  }, 0);
}

// -------- CONTROLLERS --------

// 1. Check if ticket is a winner
export const checkTicketWinningStatus = async (req, res) => {
  try {
    const { ticketId } = req.body;
    if (!ticketId) {
      return res.status(400).json({ error: "ticketId is required" });
    }

    // 1. Get ticket details
    const ticket = await tickets.findOne({
      where: { id: ticketId },
      attributes: ["gameTime", "loginId", "ticketNumber", "drawTime"],
    });

    if (!ticket) {
      return res.status(404).json({ status: "error", message: "Ticket not found" });
    }

    const drawDate = extractDate(ticket.gameTime);
    const loginId = ticket.loginId;

    // 2. Parse drawTime (could be string, JSON string, or array)
    let drawTimes = ticket.drawTime;
    if (typeof drawTimes === "string") {
      try { drawTimes = JSON.parse(drawTimes); } catch { drawTimes = [drawTimes]; }
    }
    if (!Array.isArray(drawTimes)) drawTimes = [drawTimes];

    // Normalize all draw times
    drawTimes = drawTimes
      .filter(Boolean)
      .map(dt => typeof dt === "string" ? normalizeDrawTime(dt) : dt)
      .filter(Boolean);

    // 3. Parse ticket numbers
    let ticketNumberRaw = ticket.ticketNumber;
    if (typeof ticketNumberRaw !== "string") ticketNumberRaw = String(ticketNumberRaw);
    const ticketNumbersArr = extractTicketNumbers(ticketNumberRaw);

    let results = [];
    let allWinningNumbersSet = new Set();
    let anyDeclaration = false;
    let anyWinning = false;

    // 4. Check each draw time
    for (let dt of drawTimes) {
      const winningRow = await winningNumbers.findOne({
        where: {
          loginId: loginId,
          DrawTime: dt,
          drawDate: drawDate,
        },
        attributes: ["winningNumbers"],
      });

      if (!winningRow) continue;
      anyDeclaration = true;

      // Parse winning numbers
      let winningNums = winningRow.winningNumbers;
      if (typeof winningNums === "string") {
        try { winningNums = JSON.parse(winningNums); } catch { }
      }

      // Add all winning numbers for this draw to the set
      if (Array.isArray(winningNums)) {
        winningNums.forEach(obj => allWinningNumbersSet.add(obj.number));
      }

      // Check each ticket number
      const matches = ticketNumbersArr
        .map(num => {
          const match = Array.isArray(winningNums) ? winningNums.find(obj => obj.number === num) : null;
          if (match) {
            return { number: num, winningValue: match.value, drawTime: dt };
          }
          return null;
        })
        .filter(Boolean);

      if (matches.length > 0) {
        anyWinning = true;
        results.push(...matches);
      }
    }

    // 5. Response
    if (!anyDeclaration) {
      return res.status(200).json({
        status: "no_declaration",
        message: "No winning was declared for this ticket",
        drawDate,
        drawTimes,
        ticketNumbers: ticketNumbersArr
      });
    } else if (anyWinning) {
      return res.status(200).json({
        status: "winner",
        message: "Winning found",
        drawDate,
        drawTimes,
        winningTickets: results,
        allWinningNumbers: Array.from(allWinningNumbersSet)
      });
    } else {
      return res.status(200).json({
        status: "no_winning",
        message: "No winning ticket found",
        drawDate,
        drawTimes,
        ticketNumbers: ticketNumbersArr,
        allWinningNumbers: Array.from(allWinningNumbersSet)
      });
    }

  } catch (error) {
    console.error("Error in checkTicketWinningStatus:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 2. Claim ticket (save winning ticket(s) to claimedTickets)
export const claimTicket = async (req, res) => {
  try {
    const { ticketId } = req.body;
    if (!ticketId) {
      return res.status(400).json({ error: "ticketId is required" });
    }

    // Fetch ticket
    const ticket = await tickets.findOne({
      where: { id: ticketId },
      attributes: ["loginId", "ticketNumber", "drawTime", "gameTime"]
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Parse ticket numbers and quantities
    let ticketNumberRaw = ticket.ticketNumber;
    if (typeof ticketNumberRaw !== "string") ticketNumberRaw = String(ticketNumberRaw);
    const ticketNumbersArr = parseTicketNumberString(ticketNumberRaw);

    // Parse drawTime (could be JSON string/array)
    let drawTimes = ticket.drawTime;
    if (typeof drawTimes === "string") {
      try { drawTimes = JSON.parse(drawTimes); } catch { drawTimes = [drawTimes]; }
    }
    if (!Array.isArray(drawTimes)) drawTimes = [drawTimes];

    drawTimes = drawTimes
      .filter(Boolean)
      .map(dt => typeof dt === "string" ? normalizeDrawTime(dt) : dt)
      .filter(Boolean);

    // Parse drawDate from gameTime
    const drawDate = extractDate(ticket.gameTime);

    // Will collect all winning tickets (number & quantity)
    let winningTicketsArr = [];

    // For each drawTime, check if any ticket is a winner
    for (let drawTime of drawTimes) {
      const winningRow = await winningNumbers.findOne({
        where: {
          loginId: ticket.loginId,
          DrawTime: drawTime,
          drawDate: drawDate,
        },
        attributes: ["winningNumbers"],
      });

      if (!winningRow) continue;

      // Parse winning numbers array
      let winningNums = winningRow.winningNumbers;
      if (typeof winningNums === "string") {
        try { winningNums = JSON.parse(winningNums); } catch { }
      }
      const winningNumList = Array.isArray(winningNums) ? winningNums.map(obj => obj.number) : [];

      // For this drawTime, check each ticket number
      ticketNumbersArr.forEach(t => {
        if (winningNumList.includes(t.ticketNumber)) {
          winningTicketsArr.push({ ...t, drawTime });
        }
      });
    }

    if (winningTicketsArr.length === 0) {
      return res.status(200).json({
        status: "no_win",
        message: "No winning ticket found for this ticketId."
      });
    }

    // Claimed time and date = now
    const now = new Date();
    const claimedTime = now.toTimeString().split(" ")[0];
    const claimedDate = now.toISOString().split("T")[0];

    // Save to claimedTickets
    const claimed = await claimedTickets.create({
      TicketId: ticketId,
      loginId: ticket.loginId,
      ticketNumbers: winningTicketsArr,
      drawTime: winningTicketsArr.map(t => t.drawTime).join(","),
      drawDate,
      claimedTime,
      claimedDate
    });

    return res.status(201).json({
      status: "success",
      message: "Winning ticket(s) claimed successfully",
      claimedTicket: claimed
    });

  } catch (error) {
    console.error("Error in claimTicket:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// 3. Get claimed tickets by loginId, date range
export const getClaimedTickets = async (req, res) => {
  try {
    const { loginId, fromDate, toDate } = req.body;
    if (!loginId || !fromDate || !toDate) {
      return res.status(400).json({ error: "loginId, fromDate, and toDate are required." });
    }

    // Query: claimedDate between fromDate and toDate (inclusive)
    const where = {
      loginId: loginId,
      claimedDate: {
        [Op.gte]: fromDate,
        [Op.lte]: toDate,
      },
    };

    // Fetch all claimed tickets for this loginId in date range
    const claimed = await claimedTickets.findAll({
      where,
      order: [["claimedDate", "DESC"], ["claimedTime", "DESC"]],
    });

    // Format result
    const result = claimed.map(row => {
      let ticketNumbersArr = row.ticketNumbers;
      if (typeof ticketNumbersArr === "string") {
        try { ticketNumbersArr = JSON.parse(ticketNumbersArr); } catch { ticketNumbersArr = []; }
      }
      return {
        ticketId: row.TicketId,
        totalQuantity: getTotalQuantity(ticketNumbersArr),
        ticketNumbers: extractTicketNumbers(ticketNumbersArr),
        drawDate: row.drawDate,
        drawTime: row.drawTime,
        claimedDate: row.claimedDate,
        claimedTime: row.claimedTime,
      };
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error("Error in getClaimedTickets:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
