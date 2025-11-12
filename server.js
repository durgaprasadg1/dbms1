if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { sequelize, Supplier, Medicine, Order, OrderItem } = require("./models");
const mysql = require("mysql2");
const app = express();

app.use(express.json());
app.use(cookieParser());

app.use(async (req, res, next) => {
  const token = req.cookies && req.cookies.token;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
      req.user = payload;
      res.locals.currentUser = payload;
    } catch (err) {
      req.user = null;
      res.locals.currentUser = null;
    }
  } else {
    req.user = null;
    res.locals.currentUser = null;
  }

  try {
    const lowCount = await Medicine.count({ where: { lowStockFlag: true } });
    res.locals.lowStockCount = lowCount || 0;
  } catch (e) {
    res.locals.lowStockCount = 0;
  }

  next();
});

const connection = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  database: process.env.DB_NAME || "pharma",
  password: process.env.DB_PASS || "",
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
});

connection.connect((err) => {
  if (err) {
    console.error("Database connection failed (mysql2):", err.stack);
    return;
  }
  console.log("Connected to MySQL (mysql2) as ID", connection.threadId);
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  if (!req.user) return res.redirect('/login');
  return res.redirect('/medicines');
});

app.use("/perf", require("./routes/perf-routes"));
app.use(require("./routes/auth"));

app.get("/medicines", async (req, res) => {
  const Op = require("sequelize").Op;
  const { q, supplier, minPrice, maxPrice, stockLessThan, expiryBefore } = req.query || {};
  const where = {};
  if (q) where.name = { [Op.like]: `%${q}%` };
  if (minPrice || maxPrice) {
    const min = minPrice ? Number(minPrice) : 0;
    const max = maxPrice ? Number(maxPrice) : 9999999;
    where.price = { [Op.between]: [min, max] };
  }
  if (stockLessThan) where.stock = { [Op.lte]: Number(stockLessThan) };
  if (expiryBefore) where.expiryDate = { [Op.lte]: expiryBefore };

  if (supplier) where.supplierId = supplier;

  const medicines = await Medicine.findAll({
    where,
    include: Supplier,
    order: [["name", "ASC"]],
  });
  res.render("medicines", { medicines, moment: require("moment") });
});

app.get("/medicines/new", async (req, res) => {
  const suppliers = await Supplier.findAll();
  res.render("add_medicine", { suppliers });
});

app.post("/medicines", async (req, res) => {
  if (!req.user) return res.redirect('/login');
  const { name, supplierId, price, stock, expiryDate } = req.body;
  try {
    if (expiryDate) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const ed = new Date(expiryDate);
      ed.setHours(0,0,0,0);
      if (ed < today) {
        const suppliers = await Supplier.findAll();
        return res.render('add_medicine', { suppliers, formData: { name, supplierId, price, stock, expiryDate }, error: 'Cannot add a medicine that is already expired.' });
      }
    }
  } catch (e) {
    console.warn('Expiry date check failed', e && e.message);
  }
  await Medicine.create({
    name,
    supplierId: supplierId || null,
    price: parseFloat(price) || 0,
    stock: parseInt(stock) || 0,
    expiryDate,
  });
  res.redirect("/medicines");
});

app.get('/medicines/:id/edit', async (req, res) => {
  if (!req.user) return res.redirect('/login');
  const med = await Medicine.findByPk(req.params.id);
  if (!med) return res.status(404).send('Not found');
  const suppliers = await Supplier.findAll();
  res.render('add_medicine', { suppliers, medicine: med });
});

app.post('/medicines/:id', async (req, res) => {
  if (!req.user) return res.redirect('/login');
  const med = await Medicine.findByPk(req.params.id);
  if (!med) return res.status(404).send('Not found');
  const { name, supplierId, price, stock, expiryDate } = req.body;
  try {
    if (expiryDate) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const ed = new Date(expiryDate);
      ed.setHours(0,0,0,0);
      if (ed < today) {
        const suppliers = await Supplier.findAll();
        med.name = name;
        med.supplierId = supplierId || null;
        med.price = parseFloat(price) || 0;
        med.stock = parseInt(stock) || 0;
        med.expiryDate = expiryDate || null;
        return res.render('add_medicine', { suppliers, medicine: med, error: 'Cannot set expiry date in the past.' });
      }
    }
  } catch (e) {
    console.warn('Expiry date check failed', e && e.message);
  }
  med.name = name;
  med.supplierId = supplierId || null;
  med.price = parseFloat(price) || 0;
  med.stock = parseInt(stock) || 0;
  med.expiryDate = expiryDate || null;
  await med.save();
  res.redirect('/medicines');
});

app.get('/expiring', async (req, res) => {
  const moment = require('moment');
  const today = moment().format('YYYY-MM-DD');
  const soon = moment().add(30, 'days').format('YYYY-MM-DD');
  const expired = await Medicine.findAll({ where: { expiryDate: { [require('sequelize').Op.lte]: today } }, include: Supplier });
  const expiringSoon = await Medicine.findAll({ where: { expiryDate: { [require('sequelize').Op.between]: [today, soon] } }, include: Supplier });
  res.render('expiring', { expired, expiringSoon, moment });
});

app.get("/orders", async (req, res) => {
  const orders = await Order.findAll({
    include: [{ model: OrderItem, include: [Medicine] }],
    order: [["createdAt", "DESC"]],
  });
  res.render("orders", { orders });
});

app.get("/orders/new", async (req, res) => {
  const medicines = await Medicine.findAll({
    where: { stock: { [require("sequelize").Op.gt]: 0 } },
    order: [["name", "ASC"]],
  });
  res.render("create_order", { medicines });
});

app.post("/orders", async (req, res) => {
  const { items } = req.body; 

  let parsed = [];
  if (!items) return res.redirect("/orders");

  if (Array.isArray(items)) {
    parsed = items.map((it) => ({
      medicineId: parseInt(it.medicineId),
      quantity: parseInt(it.quantity),
    }));
  } else if (typeof items === "object") {
    if (items.medicineId) {
      parsed.push({
        medicineId: parseInt(items.medicineId),
        quantity: parseInt(items.quantity),
      });
    }
  }

  const t = await sequelize.transaction();
  try {
    const order = await Order.create({}, { transaction: t });

    for (const it of parsed) {
      if (!it.medicineId || !it.quantity || it.quantity <= 0) continue;
      const med = await Medicine.findByPk(it.medicineId, {
        transaction: t,
      });
      if (!med) throw new Error("Medicine not found: " + it.medicineId);
      if (med.stock < it.quantity)
        throw new Error(`Insufficient stock for ${med.name}`);
      med.stock = med.stock - it.quantity;
      await med.save({ transaction: t });
      await OrderItem.create(
        {
          orderId: order.id,
          medicineId: med.id,
          quantity: it.quantity,
          priceAtPurchase: med.price,
        },
        { transaction: t }
      );
    }

    await t.commit();
    res.redirect("/orders");
  } catch (err) {
    await t.rollback();
    console.error("Order creation failed:", err.message);
    res
      .status(400)
      .send("Order failed: " + err.message + "\n\n(See server logs)");
  }
});

app.get("/suppliers", async (req, res) => {
  const suppliers = await Supplier.findAll({ order: [["name", "ASC"]] });
  res.render("suppliers", { suppliers });
});

app.get("/suppliers/new", (req, res) => res.render("add_supplier"));
app.post("/suppliers", async (req, res) => {
  await Supplier.create({ name: req.body.name, contact: req.body.contact });
  res.redirect("/suppliers");
});

const PORT = process.env.PORT || 3002;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Choose a different PORT or stop the process using it.`
    );
    process.exit(1);
  } else {
    console.error("Server error:", err);
    process.exit(1);
  }
});
