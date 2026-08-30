module.exports = {
  apps: [
    {
      name: "qistflow-web",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "qistflow-worker",
      script: "npx",
      args: "tsx scripts/start-worker.ts",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
