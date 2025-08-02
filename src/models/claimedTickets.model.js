import { sequelizeCon, DataTypes } from "../init/dbConnection.js";

const claimedTickets = sequelizeCon.define(
  "claimedTickets",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    TicketId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    loginId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ticketNumbers: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    drawTime: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    drawDate: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    claimedTime: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    claimedDate: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    timestamps: true,
  }
);

export { claimedTickets };
