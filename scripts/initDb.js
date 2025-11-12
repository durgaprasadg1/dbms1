require("dotenv").config();
const {
  sequelize,
  Supplier,
  Medicine,
  Order,
  OrderItem,
  User,
} = require("../models");
const moment = require("moment");

const LOW_STOCK_THRESHOLD = 20;

async function runRawQueries() {
  
  await sequelize.query(`
    CREATE TRIGGER before_medicine_update
    BEFORE UPDATE ON Medicines
    FOR EACH ROW
    BEGIN
      IF NEW.stock <= ${LOW_STOCK_THRESHOLD} THEN
        SET NEW.lowStockFlag = TRUE;
      ELSE
        SET NEW.lowStockFlag = FALSE;
      END IF;
    END;
  `);

  await sequelize.query(`
    CREATE OR REPLACE VIEW vw_low_stock_medicines AS
    SELECT * FROM Medicines WHERE stock <= ${LOW_STOCK_THRESHOLD};
  `);

  await sequelize.query(`
    CREATE OR REPLACE VIEW vw_expiring_soon AS
    SELECT * FROM Medicines WHERE expiryDate BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY);
  `);
}

async function init() {
  try {
    console.log("Connecting to database...");
    await sequelize.authenticate();
    console.log("Connection successful. Syncing database (force: true)...");
    await sequelize.sync({ force: true });
    console.log(
      "Database synced. Running raw queries for triggers and views..."
    );
    await runRawQueries();
    console.log("Triggers and views created. Seeding data...");

    const suppliers = [];
    const supplierNames = [
      "Global Pharma",
      "Health Inc.",
      "MediCorp",
      "PharmaPlus",
      "BioHealth",
      "CureAll",
      "VitalMeds",
      "DrugWorld",
      "MediSupply",
      "PharmAid",
    ];
    for (let i = 0; i < 10; i++) {
      const name = supplierNames[i];
      const slug = name.toLowerCase().replace(/\W+/g, "");
      suppliers.push(
        await Supplier.create({
          name,
          contact: `contact@${slug}.com`,
          email: `info@${slug}.com`,
        })
      );
    }

    const medicineNames = [
      "Paracetamol",
      "Aspirin",
      "Ibuprofen",
      "Amoxicillin",
      "Ciprofloxacin",
      "Metformin",
      "Lisinopril",
      "Amlodipine",
      "Omeprazole",
      "Simvastatin",
      "Losartan",
      "Gabapentin",
      "Sertraline",
      "Escitalopram",
      "Albuterol",
      "Prednisone",
      "Furosemide",
      "Warfarin",
      "Clopidogrel",
      "Atorvastatin",
      "Levothyroxine",
      "Metoprolol",
      "Hydrochlorothiazide",
      "Fluoxetine",
      "Tramadol",
      "Doxycycline",
      "Azithromycin",
      "Cephalexin",
      "Pantoprazole",
      "Rosuvastatin",
      "Tamsulosin",
      "Finasteride",
      "Montelukast",
      "Bupropion",
      "Venlafaxine",
      "Duloxetine",
      "Pregabalin",
      "Lamotrigine",
      "Carbamazepine",
      "Valproate",
      "Risperidone",
      "Olanzapine",
      "Quetiapine",
      "Aripiprazole",
      "Haloperidol",
      "Lorazepam",
      "Alprazolam",
      "Clonazepam",
      "Diazepam",
      "Zolpidem",
      "Codeine",
      "Oxycodone",
      "Morphine",
      "Fentanyl",
      "Methadone",
      "Insulin",
      "Glipizide",
      "Pioglitazone",
      "Sitagliptin",
      "Exenatide",
      "Vitamin D",
      "Calcium",
      "Iron",
      "Folic Acid",
      "B12",
      "Omega-3",
      "Probiotics",
      "Melatonin",
      "Caffeine",
      "Nicotine",
      "Epinephrine",
      "Diphenhydramine",
      "Loratadine",
      "Cetirizine",
      "Fexofenadine",
      "Salbutamol",
      "Beclomethasone",
      "Fluticasone",
      "Budesonide",
      "Montelukast",
      "Theophylline",
      "Aminophylline",
      "Terbutaline",
      "Ipratropium",
      "Tiotropium",
      "Heparin",
      "Enoxaparin",
      "Dalteparin",
      "Fondaparinux",
      "Rivaroxaban",
      "Apixaban",
      "Edoxaban",
      "Dabigatran",
      "Argatroban",
      "Bivalirudin",
      "Acetaminophen",
      "Naproxen",
      "Celecoxib",
      "Indomethacin",
      "Ketorolac",
      "Diclofenac",
      "Piroxicam",
      "Meloxicam",
      "Etodolac",
      "Nabumetone",
    ];
    const medicines = [];
    for (let i = 0; i < 100; i++) {
      const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
      const stock = Math.floor(Math.random() * 200) + 1; 
      const price = Math.round((Math.random() * 50 + 1) * 100) / 100; 
      const expiryDays = Math.floor(Math.random() * 1095) + 30; 
      medicines.push({
        name: `${medicineNames[i % medicineNames.length]} ${
          Math.floor(Math.random() * 500) + 100
        }mg`,
        supplierId: supplier.id,
        price,
        stock,
        expiryDate: moment().add(expiryDays, "days").format("YYYY-MM-DD"),
      });
    }
    await Medicine.bulkCreate(medicines);

    try {
      const bcrypt = require('bcryptjs');
      const adminUser = await User.create({
        username: process.env.ADMIN_USER || 'admin',
        passwordHash: await bcrypt.hash(process.env.ADMIN_PASS || 'password', 10),
      });
      console.log('Admin user created:', adminUser.username);
    } catch (e) {
      console.log('Could not create admin user (User model may be missing):', e.message);
    }

    const orders = [];
    for (let i = 0; i < 20; i++) {
      const order = await Order.create({
        status: Math.random() > 0.5 ? "completed" : "pending",
      });
      orders.push(order);
    }

    for (const order of orders) {
      const numItems = Math.floor(Math.random() * 5) + 1; 
      for (let j = 0; j < numItems; j++) {
        const medicine =
          medicines[Math.floor(Math.random() * medicines.length)];
        const quantity = Math.floor(Math.random() * 10) + 1; 
        await OrderItem.create({
          orderId: order.id,
          medicineId: medicine.id,
          quantity,
          priceAtPurchase: medicine.price,
        });
      }
    }

    console.log("Sample data seeded. Init complete.");
  } catch (err) {
    console.error("Init failed:", err);
  } finally {
    await sequelize.close();
  }
}

init();
