const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors"); // ✅ REQUIRED
require("dotenv").config();

const app = express();

// 🔐 Extension origin (for real users, this must be updated if their ID changes)
// Update your CORS configuration to this:
const EXTENSION_ID = "iobkboneibdcnodgpiafkekccdjjiikd";
const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`;

app.use(cors({
  origin: [
    EXTENSION_ORIGIN,
    "http://localhost", // for local testing
    "https://resumailer.onrender.com" // your Render domain
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true
}));
// Keep your existing CORS middleware as fallback
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", EXTENSION_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204); // No Content (works better than 200 sometimes)
  }
  next();
});

// Rest of your code remains the same
app.use(express.json({ limit: "10mb" }));

// ✅ POST /send-email
app.post("/send-email", async (req, res) => {
  const { from, to, subject, body, password, attachment, filename } = req.body;

  if (!from || !to || !subject || !body || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: from,
        pass: password, // Gmail app password
      },
    });

    const mailOptions = {
      from,
      to,
      subject,
      html: body,
      attachments: attachment
        ? [{ filename, content: attachment, encoding: "base64" }]
        : [],
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error("❌ Email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send email.",
      error: error.message,
    });
  }
});

// ✅ GET /
app.get("/", (req, res) => {
  res.send("✅ Nodemailer server is live.");
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
