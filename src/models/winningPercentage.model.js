import { DataTypes, sequelizeCon } from "../init/dbConnection.js";

const winningPercentage = sequelizeCon.define(
    "winningPercentage",
    {
        percentage : {
            type : DataTypes.INTEGER,
            allowNull: false,
        }
    },{
        timestamps: true,
    }
)

export {winningPercentage};