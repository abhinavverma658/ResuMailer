document.addEventListener("DOMContentLoaded", async () => {
  const fields = ["position", "smtpEmail", "smtpPassword", "defaultMessage", "resumeFilePath", "excelFilePath"];
  const secretKey = "resumail_secret";
  const getEl = id => document.getElementById(id);
  const elements = {
    checkbox: getEl("useExcelMessage"),
    defaultMessageWrapper: getEl("defaultMessageWrapper"),
    resumeFilePath: getEl("resumeFilePath"),
    excelFilePath: getEl("excelFilePath"),
    selectResumeBtn: getEl("selectResumeBtn"),
    selectExcelBtn: getEl("selectExcelBtn"),
    permissionBtn: getEl("requestFilePermissions"),
  };

  chrome.storage.local.get(fields, (saved) => {
    fields.forEach((field) => {
      const el = getEl(field);
      if (!el || !saved[field]) return;
      let value = saved[field];
      if (field === "smtpPassword") {
        try {
          value = CryptoJS.AES.decrypt(value, secretKey).toString(CryptoJS.enc.Utf8);
        } catch (err) {
          console.error("Decryption error:", err);
          return;
        }
      }
      el.value = value;
    });
  });

  fields.forEach((field) => {
    const el = getEl(field);
    el?.addEventListener("input", () => {
      const value = field === "smtpPassword"
        ? CryptoJS.AES.encrypt(el.value, secretKey).toString()
        : el.value;
      chrome.storage.local.set({ [field]: value });
    });
  });

  const toggleMessageVisibility = (useExcel) => {
    if (elements.defaultMessageWrapper)
      elements.defaultMessageWrapper.style.display = useExcel ? "none" : "block";
  };

  if (elements.checkbox) {
    toggleMessageVisibility(elements.checkbox.checked);
    elements.checkbox.addEventListener("change", e =>
      toggleMessageVisibility(e.target.checked)
    );
  }

  const pickFile = async (type, fileTypes, pathFieldId) => {
    try {
      const [handle] = await window.showOpenFilePicker({ types: [fileTypes] });
      if (handle) {
        await saveFileHandle(type, handle);
        const inputField = getEl(pathFieldId);
        if (inputField) {
          inputField.value = handle.name;
          chrome.storage.local.set({ [pathFieldId]: handle.name });
        }
      }
    } catch (err) {
      console.log("File selection cancelled or failed:", err);
    }
  };

  elements.selectResumeBtn?.addEventListener("click", () =>
    pickFile("resume", {
      description: "Resume Files",
      accept: { "application/pdf": [".pdf"], "application/msword": [".doc", ".docx"] }
    }, "resumeFilePath")
  );

  elements.selectExcelBtn?.addEventListener("click", () =>
    pickFile("excel", {
      description: "Excel Files",
      accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }
    }, "excelFilePath")
  );

  const tryParseExcelIfPermitted = async () => {
    const excelHandle = await loadFileHandle("excel");
    if (!excelHandle) return console.log("Excel handle not found.");

    const granted = await hasPermission(excelHandle);
    if (!granted) return console.log("Excel permission not granted.");

    try {
      const file = await excelHandle.getFile();
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      console.log("✅ Excel parsed successfully:", rows);
      chrome.storage.local.set({ parsedExcelRows: rows });
    } catch (err) {
      console.error("❌ Error parsing Excel:", err);
    }
  };

  for (const type of ["resume", "excel"]) {
    const inputId = type + "FilePath";
    const inputField = getEl(inputId);
    const handle = await loadFileHandle(type);

    if (handle && await hasPermission(handle)) {
      try {
        const file = await handle.getFile();
        inputField.value = file.name;
        chrome.storage.local.set({ [inputId]: file.name });

        if (type === "excel") {
          await tryParseExcelIfPermitted();
        }
      } catch (err) {
        inputField.value = "";
        chrome.storage.local.remove(inputId);
        await deleteFileHandle(type);
      }
    } else {
      inputField.value = "";
      chrome.storage.local.remove(inputId);
      await deleteFileHandle(type);
    }
  }

  // ✅ Explicit Permission Request Handler (Only triggers on user click)
  if (elements.permissionBtn) {
    elements.permissionBtn.addEventListener("click", async () => {
      for (const type of ["resume", "excel"]) {
        const handle = await loadFileHandle(type);
        if (!handle) {
          alert(`No ${type} file handle found. Please select it first.`);
          continue;
        }

        try {
          const result = await handle.requestPermission({ mode: "read" });
          if (result === "granted") {
            alert(`${type} permission granted.`);
            if (type === "excel") await tryParseExcelIfPermitted();
          } else if (result === "denied") {
            alert(`${type} permission denied.`);
          } else {
            alert(`${type} permission prompt dismissed or unknown result.`);
          }
        } catch (err) {
          alert(`Error requesting permission for ${type}: ${err.message}`);
        }
      }
    });
  }
});

// Template generator
function getFinalMessage(row, position, company) {
  const useExcelMessage = document.getElementById("useExcelMessage")?.checked;
  const defaultMessage = document.getElementById("defaultMessage")?.value || "";
  return (useExcelMessage && row.message)
    ? row.message
    : defaultMessage
        .replaceAll("{{position}}", position)
        .replaceAll("{{company}}", company);
}

// IndexedDB functions
const openHandleDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open("fileHandlesDB", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("handles");
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const saveFileHandle = async (key, handle) => {
  const db = await openHandleDB();
  const tx = db.transaction("handles", "readwrite");
  tx.objectStore("handles").put(handle, key);
  tx.oncomplete = () => db.close();
};

const loadFileHandle = async (key) => {
  const db = await openHandleDB();
  const tx = db.transaction("handles", "readonly");
  return new Promise((resolve) => {
    const req = tx.objectStore("handles").get(key);
    req.onsuccess = () => {
      db.close();
      resolve(req.result);
    };
    req.onerror = () => {
      db.close();
      resolve(null);
    };
  });
};

const deleteFileHandle = async (key) => {
  const db = await openHandleDB();
  const tx = db.transaction("handles", "readwrite");
  tx.objectStore("handles").delete(key);
  tx.oncomplete = () => db.close();
};

const hasPermission = async (handle) => {
  if (!handle) return false;
  const opts = { mode: 'read' };
  let perm = await handle.queryPermission?.(opts);
  return perm === 'granted';
};
