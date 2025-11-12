const { performance } = require("perf_hooks");
const { sequelize } = require("../models");

async function measureQuery(query, options = {}) {
  const start = performance.now();
  const [results] = await sequelize.query(query, options);
  const end = performance.now();
  return {
    time: (end - start).toFixed(3),
    results,
  };
}

module.exports = { measureQuery };
