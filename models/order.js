module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define(
    "Order",
    {
      status: {
        type: DataTypes.STRING,
        defaultValue: "pending",
      },
    },
    {
      indexes: [
        {
          name: "idx_order_status",
          fields: ["status"],
        },
      ],
    }
  );
  return Order;
};
