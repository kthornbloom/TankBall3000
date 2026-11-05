module.exports = {
  apps: [{
    name: 'tankball3000-multiplayer',
    script: 'src/server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    time: true
  }]
};
