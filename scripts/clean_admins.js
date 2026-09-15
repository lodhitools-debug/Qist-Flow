const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanUpAdmins() {
  const targetEmail = 'lodhitools@gmail.com';
  
  // Find all SUPER_ADMIN and ADMIN users
  const admins = await prisma.user.findMany({
    where: {
      role: {
        in: ['SUPER_ADMIN', 'ADMIN']
      }
    }
  });

  for (const admin of admins) {
    if (admin.email !== targetEmail) {
      console.log(`Downgrading user ${admin.email} from ${admin.role} to RECOVERY_OFFICER...`);
      await prisma.user.update({
        where: { id: admin.id },
        data: { role: 'RECOVERY_OFFICER' }
      });
    }
  }

  // Ensure lodhitools@gmail.com exists and is SUPER_ADMIN
  const targetUser = await prisma.user.findUnique({
    where: { email: targetEmail }
  });

  if (targetUser) {
    console.log(`Ensuring ${targetEmail} is SUPER_ADMIN...`);
    await prisma.user.update({
      where: { id: targetUser.id },
      data: { role: 'SUPER_ADMIN' }
    });
  } else {
    console.log(`${targetEmail} not found. They will be created when they log in via Google.`);
  }

  console.log('Cleanup complete.');
}

cleanUpAdmins()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
