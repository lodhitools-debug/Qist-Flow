import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const email = "testing@gmailcom";
  const passwordHash = await bcrypt.hash("123456", 10);
  await prisma.user.update({
    where: { email },
    data: { passwordHash }
  });
  console.log("Password changed to 123456 for", email);
}
main();
