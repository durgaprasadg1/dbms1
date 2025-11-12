module.exports = (sequelize, DataTypes) => {
  const Supplier = sequelize.define(
    "Supplier",
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      contact: {
        type: DataTypes.STRING,
      },
      email: {
        type: DataTypes.STRING,
        validate: {
          isEmail: true,
        },
      },
    },
    {
      indexes: [
        {
          name: "idx_supplier_name",
          fields: ["name"],
        },
      ],
    }
  );
  return Supplier;
};
