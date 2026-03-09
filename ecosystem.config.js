module.exports = {
  apps: [{
    name: 'alamir-ops',
    script: '.next/standalone/server.js',
    env: {
      PORT: 3000,
      HOSTNAME: '0.0.0.0',
      NODE_ENV: 'production',
    },
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    watch: false,
    max_memory_restart: '500M',
  }],
};
