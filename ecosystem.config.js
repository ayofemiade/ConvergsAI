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
      // Note: use "venv/bin/python" on Linux (Droplet) 
      // or "venv/Scripts/python.exe" on Windows
      interpreter: "venv/bin/python",
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
