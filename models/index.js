require("dotenv").config();
const { Sequelize, DataTypes } = require("sequelize");

// Use environment variables if provided so local credentials don't leak and
// so the server.js mysql2 connection and Sequelize use the same config.
const DB_NAME = process.env.DB_NAME || "pharma";
const DB_USER = process.env.DB_USER || "root";
const DB_PASS = process.env.DB_PASS || ""; // default empty to match server.js defaults
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: "mysql",
  logging: false,
});

const Supplier = require("./supplier")(sequelize, DataTypes);
const Medicine = require("./medicine")(sequelize, DataTypes);
const User = require("./user")(sequelize, DataTypes);
const Order = require("./order")(sequelize, DataTypes);
const OrderItem = require("./orderItem")(sequelize, DataTypes);

//normalisation
Supplier.hasMany(Medicine, { foreignKey: "supplierId" });
Medicine.belongsTo(Supplier, { foreignKey: "supplierId" });

Order.hasMany(OrderItem, { foreignKey: "orderId" });
OrderItem.belongsTo(Order, { foreignKey: "orderId" });

Medicine.hasMany(OrderItem, { foreignKey: "medicineId" });
OrderItem.belongsTo(Medicine, { foreignKey: "medicineId" });

module.exports = { sequelize, Sequelize, Supplier, Medicine, Order, OrderItem };
// export User as well
module.exports.User = User;
