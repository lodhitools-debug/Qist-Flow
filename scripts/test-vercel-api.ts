import fs from "fs";

async function run() {
  console.log("Logging into Vercel...");
  const loginRes = await fetch("https://qistflow.vercel.app/api/auth/callback/credentials?", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      email: "testing@gmailcom",
      password: "123456",
      redirect: "false"
    }).toString(),
  });

  const cookies = loginRes.headers.getSetCookie();
  console.log("Login Status:", loginRes.status);
  console.log("Cookies:", cookies);

  const authCookie = cookies.find(c => c.includes("next-auth.session-token"));
  if (!authCookie) {
    console.log("Failed to get auth cookie");
    return;
  }

  console.log("Got auth cookie, calling /api/whatsapp/connect...");
  const connectRes = await fetch("https://qistflow.vercel.app/api/whatsapp/connect", {
    method: "POST",
    headers: {
      "Cookie": authCookie
    }
  });

  console.log("Connect Status:", connectRes.status);
  const data = await connectRes.text();
  console.log("Connect Response:", data);
}
run();
