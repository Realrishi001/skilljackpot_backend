import { tickets } from "../models/ticket.model.js";

const savePrintedTickets = async (req, res) => {
    try {
        const { gameTime, ticketNumber, totalQuatity, totalPoints, loginId, drawTime } = req.body;

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

export { savePrintedTickets };
