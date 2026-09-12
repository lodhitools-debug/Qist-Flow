const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: node make-superadmin.js <user-email>");
    process.exit(1);
  }

  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role: "SUPER_ADMIN" },
    });

    console.log(`Success! User ${user.email} is now a SUPER_ADMIN.`);
    console.log(`They can now log in and access the SaaS Admin panel.`);
  } catch (err) {
    console.error(`Error: User with email ${email} not found or database error.`);
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
