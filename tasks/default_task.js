// Lint and build CSS
module.exports = function(grunt) {
  grunt.registerTask('default', ['jscs', 'jshint']);
  grunt.registerTask('test', ['default', 'karma:test']);
};
