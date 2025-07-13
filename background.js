chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "sendEmails") {
    (async () => {
      const { rows, smtpEmail, smtpPassword, position, resume, useExcel, defaultMessage } = request.payload;
      const results = [];

      // Helper to wait for ms
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

      for (const [index, row] of rows.entries()) {
        // Add delay before sending, except for the first email
       if (!row.Email) continue;

  if (index > 0) {
    const delay = 30;
    // console.log(`⏳ Waiting ${delay}s before sending email #${index + 1} to ${row.Email}`);

    for (let t = delay; t > 0; t--) {
      chrome.runtime.sendMessage({
        type: "emailTimerUpdate",
        payload: {
          nextEmailIndex: index + 1,
          secondsLeft: t
        }
      });

      await sleep(1000); // 1 second
    }
  }
  // ✅ Now send the email
  // console.log(`📤 Sending email #${index + 1} to ${row.Email}`);
        const toEmail = row.Email || row.email;
        const company = row.Company || row.company || "Company";
        const messageTemplate = (useExcel && (row.Message || row.message))
          ? (row.Message || row.message)
          : defaultMessage;

        if (!toEmail) {
          const skipped = { index, toEmail, status: "skipped", reason: "Missing email" };
          results.push(skipped);
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

          const text = await res.text();
          let json;
          try {
            json = JSON.parse(text);
          } catch (e) {
            json = { success: false, message: text };
          }
          const resultObj = {
            index,
            toEmail,
            status: json.success ? "sent" : "failed",
            message: json.message,
          };
          results.push(resultObj);
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
