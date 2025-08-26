module.exports = {
  apps: [
    {
      name: "domainfo-blog",
      script: "./dist/server.js",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
