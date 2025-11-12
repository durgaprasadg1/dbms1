module.exports = (sequelize, DataTypes) => {
  const Medicine = sequelize.define(
    "Medicine",
    {
      name: { type: DataTypes.STRING, allowNull: false },
      supplierId: { type: DataTypes.INTEGER, allowNull: true },
      price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
      stock: { type: DataTypes.INTEGER, defaultValue: 0 },
      expiryDate: { type: DataTypes.DATEONLY, allowNull: true },
      lowStockFlag: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    {
      indexes: [
        { name: "idx_medicine_name", fields: ["name"] },
        { name: "idx_medicine_expiry", fields: ["expiryDate"] },
        { name: "idx_medicine_supplier", fields: ["supplierId"] },
      ],
    }
  );
  return Medicine;
};
