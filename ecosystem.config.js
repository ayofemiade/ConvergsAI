module.exports = {
  apps: [
    {
      name: "convergs-gateway",
      cwd: "./backend-node",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: 8000
      },
      autorestart: true,
      max_restarts: 10,
      exp_backoff_restart_delay: 100
    },
    {
      name: "convergs-ai-worker",
      cwd: "./backend-python",
      script: "-m app.worker",
      // Absolute path to ensure PM2 finds it on the Droplet
      interpreter: "/root/ConvergsAI/backend-python/venv/bin/python",
      args: "start --num-processes 2",
      env: {
        PYTHONPATH: ".",
        PYTHONUNBUFFERED: "1"
      },
      autorestart: true,
      max_restarts: 10,
      exp_backoff_restart_delay: 100
    }
  ]
};
