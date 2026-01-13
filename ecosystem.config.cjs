module.exports = {
  apps: [
    {
      name: 'SIP-Reminder',
      script: 'dist/index.js',
      cwd: process.cwd(),
      interpreter: 'node',
      env_file: '.env',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Memory limits (restart if memory exceeds this)
      max_memory_restart: '500M',
      // Instance management
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};