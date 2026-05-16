module.exports = {
  apps: [
    {
      name: "color-pro-web",
      script: "npm",
      args: "run start",
      env: { NODE_ENV: "production", PORT: 3000 }
    },
    {
      name: "color-pro-api",
      cwd: "./backend",
      script: "dist/server.js",
      env: { NODE_ENV: "production" }
    }
  ]
};
