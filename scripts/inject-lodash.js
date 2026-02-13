// 全局注入lodash到Hexo的EJS模板中
hexo.extend.filter.register('template_locals', function(locals) {
  // 引入lodash并赋值给_，让所有EJS模板都能访问
  locals._ = require('lodash');
  return locals;
});