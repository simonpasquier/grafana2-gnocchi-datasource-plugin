module.exports = function(config) {
  return {
    source: {
      files: {
          src: ['*.js'],
      }
    },
    tests: {
      files: {
        src: ['<%= srcDir %>/test/**/*.js'],
      }
    },
    options: {
      jshintrc: true,
      reporter: require('jshint-stylish'),
      ignores: []
    }
  };
};
