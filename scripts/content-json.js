const stripHTML = require('hexo-util').stripHTML;

hexo.extend.generator.register('content-json', function(locals) {
  const posts = locals.posts
    .sort('-date')
    .map(post => ({
      title: post.title,
      path: post.path,
      date: post.date,
      tags: post.tags && post.tags.toArray
        ? post.tags.toArray().map(tag => ({ name: tag.name }))
        : [],
      text: stripHTML(post.content || '')
        .replace(/\s+/g, ' ')
        .trim()
    }));

  return {
    path: 'content.json',
    data: JSON.stringify({ posts }),
    layout: false
  };
});
