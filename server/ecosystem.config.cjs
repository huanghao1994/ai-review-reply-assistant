module.exports = {
  apps: [
    {
      name: "ai-review-reply-server",
      script: "server.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 8787
      }
    }
  ]
};
