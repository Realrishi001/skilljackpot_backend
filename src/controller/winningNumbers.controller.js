import { winningNumbers } from "../models/winningNumbers.model.js";

export const getWinningNumbersByLoginId = async (req, res) => {
  try {
    const { loginId, drawDate } = req.body;

    if (!loginId) {
      return res.status(400).json({ message: "loginId is required" });
    }
    if (!drawDate) {
      return res.status(400).json({ message: "drawDate is required" });
    }

    // Fetch data from DB using both loginId and drawDate
    const rows = await winningNumbers.findAll({
      where: { loginId, drawDate },
      attributes: ["id", "loginId", "winningNumbers", "DrawTime", "drawDate"],
      order: [["createdAt", "DESC"]],
    });

    // Transform each row
    const formatted = rows.map(row => {
      let parsedNumbers = [];
      try {
        parsedNumbers = JSON.parse(row.winningNumbers); // convert from string to array
      } catch {
        parsedNumbers = [];
      }

      // Initialize groups
      const groups = {
        "10-19": [],
        "30-39": [],
        "50-59": []
      };

      parsedNumbers.forEach(item => {
        const numStr = item.number.toString();
        const prefix = parseInt(numStr.substring(0, 2), 10);

        if (prefix >= 10 && prefix <= 19) {
          groups["10-19"].push(item.number);
        } else if (prefix >= 30 && prefix <= 39) {
          groups["30-39"].push(item.number);
        } else if (prefix >= 50 && prefix <= 59) {
          groups["50-59"].push(item.number);
        }
      });

      return {
        id: row.id,
        loginId: row.loginId,
        DrawTime: row.DrawTime,
        drawDate: row.drawDate,
        groupedWinningNumbers: groups
      };
    });

    res.status(200).json({
      message: "Winning numbers fetched successfully.",
      data: formatted
    });

  } catch (error) {
    console.error("Error fetching grouped winning numbers:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
