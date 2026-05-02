const { createProxyMiddleware } = require('http-proxy-middleware');

/** Dev only: CRA serves the app on one port while `backend` listens on PORT (usually 4001). */
module.exports = function setupProxy(app) {
  const target =
    process.env.REACT_APP_PROXY_TARGET ||
    process.env.REACT_APP_API_BASE_ORIGIN ||
    'http://127.0.0.1:4001';

  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: {
        '^/api': '',
      },
      logLevel: 'silent',
    })
  );
};
