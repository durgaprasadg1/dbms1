const express = require("express");
const { measureQuery } = require("../lib/db-utils");
const { Medicine, Supplier, Order, OrderItem } = require("../models");
const router = express.Router();

router.get("/medicines-search", async (req, res) => {
  res.render("perf/medicines-search");
});

router.post("/medicines-search/run", async (req, res) => {
  // Read expanded payload from client
  const {
    searchTerm: rawSearchTerm = "",
    supplierName: rawSupplierName = "",
    minPrice: rawMinPrice,
    maxPrice: rawMaxPrice,
    stockLessThan: rawStockLessThan,
    expiryBefore: rawExpiryBefore,
    tests: requestedTests,
  } = req.body || {};

  const searchTerm = (rawSearchTerm || "").toString();
  const supplierName = (rawSupplierName || "").toString();
  const minPrice = rawMinPrice != null ? Number(rawMinPrice) : 0;
  const maxPrice = rawMaxPrice != null ? Number(rawMaxPrice) : 9999999;
  const stockLessThan =
    rawStockLessThan != null ? Number(rawStockLessThan) : 9999999;
  const expiryBefore = rawExpiryBefore || null;

  const availableTests = {
    basic: {
      name: "Search medicines by name (LIKE)",
      sqlWithout: `SELECT * FROM Medicines IGNORE INDEX (idx_medicine_name) WHERE name LIKE CONCAT('%', :searchTerm, '%') LIMIT 100`,
      sqlWith: `SELECT * FROM Medicines USE INDEX (idx_medicine_name) WHERE name LIKE CONCAT('%', :searchTerm, '%') LIMIT 100`,
      options: { replacements: { searchTerm } },
    },
    joinSupplier: {
      name: "Search medicines by supplier name (JOIN)",
      sqlWithout: `SELECT m.*, s.name as supplierName FROM Medicines m JOIN Suppliers s ON m.supplierId = s.id WHERE s.name LIKE CONCAT('%', :supplierName, '%') LIMIT 100`,
      sqlWith: `SELECT m.*, s.name as supplierName FROM Medicines m JOIN Suppliers s ON m.supplierId = s.id WHERE s.name LIKE CONCAT('%', :supplierName, '%') LIMIT 100`,
      options: { replacements: { supplierName: supplierName || searchTerm } },
    },
    countBySupplier: {
      name: "Count medicines by supplier",
      sqlWithout: `SELECT s.name, COUNT(m.id) as count FROM Suppliers s LEFT JOIN Medicines m ON s.id = m.supplierId GROUP BY s.id LIMIT 100`,
      sqlWith: `SELECT s.name, COUNT(m.id) as count FROM Suppliers s LEFT JOIN Medicines m ON s.id = m.supplierId GROUP BY s.id LIMIT 100`,
    },
    avgPrice: {
      name: "Average price by supplier",
      sqlWithout: `SELECT s.name, AVG(m.price) as avg_price FROM Suppliers s LEFT JOIN Medicines m ON s.id = m.supplierId WHERE m.price BETWEEN :minPrice AND :maxPrice GROUP BY s.id LIMIT 100`,
      sqlWith: `SELECT s.name, AVG(m.price) as avg_price FROM Suppliers s LEFT JOIN Medicines m ON s.id = m.supplierId WHERE m.price BETWEEN :minPrice AND :maxPrice GROUP BY s.id LIMIT 100`,
      options: { replacements: { minPrice, maxPrice } },
    },
    ordersJoin: {
      name: "Get orders with items (JOIN)",
      sqlWithout: `SELECT o.id, o.status, o.createdAt, oi.medicineId, oi.quantity, oi.priceAtPurchase FROM Orders o JOIN OrderItems oi ON o.id = oi.orderId WHERE o.createdAt <= :expiryBefore OR :expiryBefore IS NULL LIMIT 200`,
      sqlWith: `SELECT o.id, o.status, o.createdAt, oi.medicineId, oi.quantity, oi.priceAtPurchase FROM Orders o JOIN OrderItems oi ON o.id = oi.orderId WHERE o.createdAt <= :expiryBefore OR :expiryBefore IS NULL LIMIT 200`,
      options: { replacements: { expiryBefore } },
    },
    lowStock: {
      name: "Search low stock medicines",
      sqlWithout: `SELECT * FROM Medicines WHERE stock <= :stockLessThan LIMIT 100`,
      sqlWith: `SELECT * FROM Medicines WHERE stock <= :stockLessThan LIMIT 100`,
      options: { replacements: { stockLessThan } },
    },
    priceRange: {
      name: "Search medicines by price range",
      sqlWithout: `SELECT * FROM Medicines WHERE price BETWEEN :minPrice AND :maxPrice LIMIT 100`,
      sqlWith: `SELECT * FROM Medicines WHERE price BETWEEN :minPrice AND :maxPrice LIMIT 100`,
      options: { replacements: { minPrice, maxPrice } },
    },
  };

  const keys =
    Array.isArray(requestedTests) && requestedTests.length
      ? requestedTests
      : [
          "basic",
          "joinSupplier",
          "countBySupplier",
          "avgPrice",
          "ordersJoin",
          "lowStock",
          "priceRange",
        ];

  const tests = [];
  for (const k of keys) {
    if (availableTests[k]) tests.push(availableTests[k]);
  }

  const results = [];
  for (const test of tests) {
    try {
      const options = Object.assign({}, test.options || {});
      // ensure replacements exist even if empty so measureQuery won't fail
      options.replacements = options.replacements || {};
      const withoutIndex = await measureQuery(test.sqlWithout, options);
      const withIndex = await measureQuery(test.sqlWith, options);
      results.push({ name: test.name, withoutIndex, withIndex });
    } catch (error) {
      results.push({ name: test.name, error: error.message });
    }
  }

  res.json({
    results,
    searchTerm,
    supplierName,
    minPrice,
    maxPrice,
    stockLessThan,
    expiryBefore,
  });
});

module.exports = router;
