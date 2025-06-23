chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "sendEmails") {
    (async () => {
      const { rows, smtpEmail, smtpPassword, position, resume, useExcel, defaultMessage } = request.payload;
      const results = [];

      for (const [index, row] of rows.entries()) {
        const toEmail = row.Email || row.email;
        const company = row.Company || row.company || "Company";
        // const messageTemplate = row.Message || row.message || defaultMessage;
        const messageTemplate = (useExcel && (row.Message || row.message)) 
  ? (row.Message || row.message) 
  : defaultMessage;

        if (!toEmail) {
          const skipped = { index, toEmail, status: "skipped", reason: "Missing email" };
          results.push(skipped);

          // Send skipped status to popup
          chrome.runtime.sendMessage({
            type: "emailStatusUpdate",
            payload: skipped
          });

          continue;
        }

        const finalMessage = messageTemplate
          .replaceAll("{{position}}", position)
          .replaceAll("{{company}}", company);

        try {
          const res = await fetch("https://resumailer.onrender.com/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              from: smtpEmail,
              to: toEmail,
              subject: `Application for ${position}`,
              body: finalMessage,
              password: smtpPassword,
              attachment: resume.base64,
              filename: resume.name,
            }),
          });

          const json = await res.json();
          const resultObj = {
            index,
            toEmail,
            status: json.success ? "sent" : "failed",
            message: json.message,
          };
          results.push(resultObj);

          // Send update back to popup
          chrome.runtime.sendMessage({
            type: "emailStatusUpdate",
            payload: resultObj
          });

        } catch (err) {
          const errorObj = {
            index,
            toEmail,
            status: "error",
            message: err.message,
          };
          results.push(errorObj);

          // Send error back to popup
          chrome.runtime.sendMessage({
            type: "emailStatusUpdate",
            payload: errorObj
          });
        }
      }

      console.log("✅ Email results from background.js:", results);
      sendResponse({ status: "done", results });
    })();

    // 👇 Required to keep message port open for async `sendResponse`
    return true;
  }

  // Respond to health check
  if (request.type === "ping") {
    console.log("📡 Received ping from popup.");
    sendResponse({ message: "pong" });
  }
});
