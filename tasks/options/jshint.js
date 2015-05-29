module.exports = function(config) {
  return {
    source: {
      files: {
        src: ['Gruntfile.js', '<%= srcDir %>/**/*.js'],
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
