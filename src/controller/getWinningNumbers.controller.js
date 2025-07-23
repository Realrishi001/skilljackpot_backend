import { tickets } from "../models/ticket.model.js";

// Helper: "30-00 : 5, 30-12 : 10" => [{ ticket: "30-00", points: 5 }, ...]
function extractTicketEntries(str) {
  return str.split(",")
    .map(x => {
      const [num, pts] = x.trim().split(":").map(z => z.trim());
      return (num && pts && !isNaN(pts)) ? { ticket: num, points: Number(pts) } : null;
    })
    .filter(x => x && x.ticket); // Filter out empty or invalid
}

// Converts "30-00" -> 3000
function dashStringToNumber(str) {
  return Number(str.replace("-", ""));
}

export const getThirtyTicketNumbers = async (req, res) => {
  try {
    // 1. Get all tickets from DB (just need ticketNumber field)
    const allTickets = await tickets.findAll({
      attributes: ['ticketNumber']
    });

    // 2. Collect all unique ticket numbers and their points
    const ticketMap = new Map(); // ticketNum (number) -> points

    allTickets.forEach(ticket => {
      if (ticket.ticketNumber && typeof ticket.ticketNumber === "string") {
        const entries = extractTicketEntries(ticket.ticketNumber);
        entries.forEach(({ ticket, points }) => {
          const num = dashStringToNumber(ticket);
          // Optionally, sum points if ticket appears multiple times
          if (!isNaN(num)) {
            if (ticketMap.has(num)) {
              ticketMap.set(num, ticketMap.get(num) + points);
            } else {
              ticketMap.set(num, points);
            }
          }
        });
      }
    });

    // 3. Format result (limit to 30, skip nulls)
    const result = Array.from(ticketMap.entries())
      .filter(([ticketNumber]) => ticketNumber !== null && !isNaN(ticketNumber))
      .slice(0, 30) // First 30 only
      .map(([ticketNumber, points]) => ({
        ticketNumber,
        points,
        isWinning: true // Set as true since these are from DB (you can change this as per your business logic)
      }));

    return res.json({ tickets: result });
  } catch (err) {
    console.error("Error in getThirtyTicketNumbers:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
