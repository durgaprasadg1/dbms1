module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      username: { type: DataTypes.STRING, allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false },
      role: { type: DataTypes.STRING, defaultValue: "admin" },
    },
    {
      indexes: [{ name: "idx_user_username", fields: ["username"] }],
    }
  );
  return User;
};
