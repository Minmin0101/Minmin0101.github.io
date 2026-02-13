const _ = require('lodash');
// 向 Hexo 模板注入全局的 lodash 变量
hexo.extend.filter.register('template_locals', (locals) => {
  locals._ = _; // 模板中可直接用 _ 调用 lodash 方法
  return locals;
});