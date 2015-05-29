define([
  'helpers',
  'plugins/datasource/gnocchi/datasource'
], function(helpers) {
  'use strict';

  describe('gnocchiDatasource', function() {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase(['backendSrv']));

    beforeEach(ctx.createService('GraphiteDatasource'));
    beforeEach(function() {
      ctx.ds = new ctx.service({ url: [''] });
    });

    describe('Metric query', function() {
    });
  });
});
