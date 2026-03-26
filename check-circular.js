const madge = require('madge');

madge('./src', {
  fileExtensions: ['ts', 'tsx'],
  excludeRegExp: [/node_modules/]
}).then((res) => {
  const circular = res.circular();
  if (circular.length > 0) {
    console.log('Circular dependencies found:');
    console.log(circular);
  } else {
    console.log('No circular dependencies found');
  }
});