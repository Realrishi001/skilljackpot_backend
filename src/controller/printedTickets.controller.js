import { tickets } from "../models/ticket.model.js";
import Admin from "../models/admins.model.js";

const savePrintedTickets = async (req, res) => {
    try {
        const { gameTime, ticketNumber, totalQuatity, totalPoints, loginId, drawTime } = req.body;

        if (!Array.isArray(drawTime) || drawTime.length === 0) {
            return res.status(400).json({ message: "drawTime must be a non-empty array." });
            }

        const newTicket = await tickets.create({
            gameTime,
            loginId,
            ticketNumber,
            totalQuatity,
            totalPoints,
            drawTime, // add drawTime here
        });

        return res.status(201).json({
            message: "Ticket saved successfully",
            ticket: newTicket
        });

    } catch (error) {
        console.error("Error saving ticket:", error);
        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
};
const getPrintedTickets = async (req, res) => {
  try {
    const allTickets = await tickets.findAll({
      attributes: ["id", "gameTime", "totalPoints"], // Removed ticketNumber as id is ticketNo
      order: [["id", "DESC"]]
    });

    const result = allTickets.map(t => {
      // Split the date and time
      let gameDate = "";
      let gameTime = "";
      if (typeof t.gameTime === "string") {
        const [date, ...timeParts] = t.gameTime.split(" ");
        gameDate = date || "";
        gameTime = timeParts.join(" ") || "";
      }
      return {
        ticketNo: t.id,        // Use id as ticketNo
        gameDate,
        gameTime,
        totalPoints: t.totalPoints
      };
    });

    return res.status(200).json({ message: "success", data: result });
  } catch (err) {
    console.error("Error fetching tickets:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};


export const subtractAdminBalance = async (req, res) => {
  try {
    const { id, amount } = req.body;

    // Validate input
    if (!id || typeof amount !== "number" || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid id or amount." });
    }

    // Find the admin by id
    const admin = await Admin.findOne({ where: { id } });

    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found." });
    }

    // Commission logic
    const commissionRate = admin.commission || 0; // percentage, e.g., 5
    const commissionAmount = (commissionRate / 100) * amount;
    const netSubtract = amount - commissionAmount;

    // Optional: round to 2 decimal places for paisa handling
    const netSubtractRounded = Math.round(netSubtract * 100) / 100;

    // Check if the net amount is bigger than the balance
    if (admin.balance < netSubtractRounded) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient balance. Your current balance is ${admin.balance}, which is less than the required deduction (${netSubtractRounded}).`
      });
    }

    // Subtract the net amount from the current balance
    admin.balance = admin.balance - netSubtractRounded;
    await admin.save();

    res.status(200).json({
      success: true,
      message: `Balance subtracted successfully for admin ID ${id}. Commission deducted: ${commissionAmount}. Net deducted: ${netSubtractRounded}.`,
      updatedBalance: admin.balance,
      commission: commissionAmount,
      netSubtracted: netSubtractRounded,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error while subtracting balance.",
      error: error.message,
    });
  }
};



export { savePrintedTickets, getPrintedTickets };
