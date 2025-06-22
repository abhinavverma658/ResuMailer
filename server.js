const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
require("dotenv").config();

const app = express();

const EXTENSION_ORIGIN = "chrome-extension://iobkboneibdcnodgpiafkekccdjjiikd";

// 🔁 Reusable CORS config object
const corsOptions = {
  origin: EXTENSION_ORIGIN,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
};

// Apply CORS middleware globally
app.use(cors(corsOptions));

// ✅ Apply CORS to preflight OPTIONS requests (same config)
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "10mb" }));

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
        pass: password,
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
    console.error("Email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send email.",
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => {
  res.send("✅ Nodemailer server is running.");
});

app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
