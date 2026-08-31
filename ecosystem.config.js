module.exports = {
  apps: [
    {
      name: "qistflow-web",
      script: "node_modules/.bin/next",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "qistflow-worker",
      script: "scripts/worker-launcher.js",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        IS_WORKER: "true",
      },
    },
  ],
};
