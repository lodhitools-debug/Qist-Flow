import nodeCrypto from "node:crypto";
(global as any).crypto = (nodeCrypto as any).webcrypto;
(globalThis as any).crypto = (nodeCrypto as any).webcrypto;

import makeWASocket, { useMultiFileAuthState, Browsers, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import path from "path";

async function testPairing(phone: string) {
  let cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cleanPhone.startsWith("03") && cleanPhone.length === 11) {
    cleanPhone = "92" + cleanPhone.slice(1);
  }

  const sessionDir = path.join(process.cwd(), ".whatsapp_test_auth");
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1043857760] as any }));

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.windows("Chrome"),
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 15000,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr } = update;
    console.log("Connection Update:", connection, qr ? "(has QR)" : "");
  });

  console.log("Waiting 4 seconds for socket to open before requesting pairing code for:", cleanPhone);
  await new Promise((r) => setTimeout(r, 4000));

  try {
    const code = await sock.requestPairingCode(cleanPhone);
    console.log("SUCCESS! Pairing Code:", code);
  } catch (err: any) {
    console.error("Pairing code error:", err);
  }
}

testPairing("03172234518");
