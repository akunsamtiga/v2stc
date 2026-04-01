module.exports = {
  apps: [{
    name:                'stockity-dashboard',
    script:              'npm',
    args:                'start',
    cwd:                 '/c/Users/Sani/stockity-dashboard',
    instances:           1,
    autorestart:         true,
    watch:               false,
    max_memory_restart:  '512M',
    env: {
      NODE_ENV: 'production',
      PORT:     3002,
    },
  }],
};
