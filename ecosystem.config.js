module.exports = {
  apps: [
    {
      name: 'aqua-backend-gateway',
      cwd: './backend',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'aqua-frontend-app',
      cwd: './frontend',
      script: 'npx',
      args: 'vite preview --port 3000 --host 0.0.0.0',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
