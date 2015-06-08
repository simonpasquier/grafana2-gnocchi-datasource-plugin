define([
  'helpers',
  'moment',
  'plugins/datasource/gnocchi/datasource',
], function(helpers, moment) {
  'use strict';

  describe('GnocchiDatasource', function() {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.createService('GnocchiDatasource'));
    beforeEach(function() {
      moment.utc = sinon.stub().returns(moment("2014-04-10T05:20:10Z").utc());
      ctx.ds = new ctx.service({ url: [''], jsonData: {token: 'XXXXXXXXXXXXX'} });
    });

    describe('Resource search', function() {
      var query = {
        range: { from: 'now-2h', to: 'now' },
        targets: [{ queryMode: 'resource_search', resource_search: '{"=": {"server_group": "autoscalig_group}}', resource_type: 'instance', label: 'display_name', metric_name: 'cpu_util', aggregator: 'max' }],
        interval: '1s'
      };

      var url_expected_search_resources = "/v1/search/resource/instance";
      var response_search_resources = [
        {
          "display_name": "myfirstvm",
          "host": "compute1",
          "id": "6868da77-fa82-4e67-aba9-270c5ae8cbca",
          "image_ref": "http://image",
          "type": "instance",
          "server_group": "autoscalig_group",
        },
        {
          "display_name": "mysecondvm",
          "host": "compute1",
          "id": "f898ba55-bbea-460f-985c-3d1243348304",
          "image_ref": "http://image",
          "type": "instance",
          "server_group": "autoscalig_group",
        }
      ]

      var url_expected_get_measures1 = "/v1/resource/instance/6868da77-fa82-4e67-aba9-270c5ae8cbca/metric/cpu_util/measures?aggregation=max&end=2014-04-10T03:20:10.000Z&start=2014-04-10T03:20:10.000Z";
      var response_get_measures1 = [
        ["2014-10-06T14:33:57", "60.0", "43.1"],
        ["2014-10-06T14:34:12", "60.0", "12"],
        ["2014-10-06T14:34:20", "60.0", "2"],
      ];

      var url_expected_get_measures2 = "/v1/resource/instance/f898ba55-bbea-460f-985c-3d1243348304/metric/cpu_util/measures?aggregation=max&end=2014-04-10T03:20:10.000Z&start=2014-04-10T03:20:10.000Z";
      var response_get_measures2 = [
        ["2014-10-06T14:33:57", "60.0", "22.1"],
        ["2014-10-06T14:34:12", "60.0", "3"],
        ["2014-10-06T14:34:20", "60.0", "30"],
      ];

      var results;
      beforeEach(function() {
        ctx.$httpBackend.expect('POST', url_expected_search_resources).respond(response_search_resources);
        ctx.$httpBackend.expect('GET', url_expected_get_measures1).respond(response_get_measures1);
        ctx.$httpBackend.expect('GET', url_expected_get_measures2).respond(response_get_measures2);
        ctx.ds.query(query).then(function(data) { results = data; });
        ctx.$httpBackend.flush();
      });

      it('should generate the correct query', function() {
        ctx.$httpBackend.verifyNoOutstandingExpectation();
      });

      it('should return series list', function() {
        expect(results.data.length).to.be(2);
        expect(results.data[0].target).to.be('myfirstvm');
        expect(results.data[1].target).to.be('mysecondvm');
      });

    });
  });
});
