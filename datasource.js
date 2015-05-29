define([
  'angular',
  'lodash',
  'kbn',
  'moment',
  './queryCtrl',
],
function (angular, _, kbn, moment) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('GnocchiDatasource', function($q, backendSrv) {

    function GnocchiDatasource(datasource) {
      this.type = 'gnocchi';
      this.name = datasource.name;
      this.keystone_endpoint = datasource.url;
      this.username = datasource.username;
      this.password = datasource.password;
      this.url = null;
      this.token = null;

      // NOTE(sileht): override until we have a clue to support keytone
      this.url = datasource.url;
      this.token = datasource.jsonData.token;

      this.default_headers = {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.token,
      },

      this.supportMetrics = true;
      this.editorSrc = 'app/features/gnocchi/partials/query.editor.html';
    }
    // Called once per panel (graph)
    GnocchiDatasource.prototype.query = function(options) {
      var deferred = $q.defer();
      var self = this;
      this.ensure_authentified(deferred, function() {
        return self.do_query(options);
      });
      return deferred.promise;
    };

    ////////////////
    /// Query
    ////////////////

    GnocchiDatasource.prototype.query = function(options) {
      var self = this;
      var promises = _.map(options.targets, function(target) {
        var default_measures_req = {
          method: 'GET',
          headers: this.default_headers,
          params: {
            'aggregation': target.aggregator,
            'start': to_iso8601(options.range.from),
          }
        };
        if (options.range.to){
          default_measures_req.params.end = to_iso8601(options.range.to);
        }

        if (target.queryMode === "resource_search") {
          var resource_search_req = {
            url: self.url + '/v1/search/resource/instance',
            method: 'POST',
            headers: this.default_headers,
            body: target.resource_search,
          };
          return backendSrv.datasourceRequest(resource_search_req).then(function(result) {
            var promise = _.map(result.data, function(resource) {
              var measures_req = _.merge({}, default_measures_req);
              measures_req.url = (self.url + '/v1/resource/' + (target.resource_type || 'generic') +
                                  '/' + resource["id"] + '/metric/' + target.metric_name + '/measures');
              var label = resource[target.label];
              if (!label) { label = resource["id"]; }
              return retrieve_measures(label, measures_req);
            }, this);
            return $q.all(promise).then(function(measures) {
              return measures;
            });
          });
        } else if (target.queryMode === "resource_aggregation") {
          default_measures_req.url = (self.url + '/v1/aggregation/resource/' +
                                      (target.resource_type || 'generic') + '/metric/' + target.metric_name);
          default_measures_req.method = 'POST';
          default_measures_req.body = target.resource_search;
          return retrieve_measures(target.label || "unlabeled", default_measures_req);

        } else if (target.queryMode === "resource") {
          default_measures_req.url = (self.url + '/v1/resource/' + target.resource_type + '/' +
                                      target.resource_id + '/metric/' + target.metric_name+ '/measures');
          return retrieve_measures(target.resource_id, default_measures_req);

        } else if (target.queryMode === "metric") {
          default_measures_req.url = self.url + '/v1/metric/' + target.metric_id + '/measures';
          return retrieve_measures(target.metric_id, default_measures_req);
        }

      }, this);
      return $q.all(promises).then(function(results) {
        return { data: _.flatten(results) };
      });
    };

    function retrieve_measures(name, reqs) {
      return backendSrv.datasourceRequest(reqs).then(function(result) {
        var dps = [];
        _.each(result.data.sort(), function(metricData) {
          dps.push([metricData[2], to_utc_epoch_seconds(metricData[0])]);
        });
        return { target: name, datapoints: dps };
      });
    }

    /////////////////////////
    /// Completion method
    /////////////////////////

    GnocchiDatasource.prototype.performSuggestQuery = function(query, type) {
      // handle only type == 'metrics'
      var options = {
          method: 'GET',
          headers: this.default_headers,
      };
      var attribute = "id";
      if (type === 'metrics') {
        options.url = this.url + '/v1/metric';
      }
      return backendSrv.datasourceRequest(options).then(function(result) {
        return _.map(result.data, function(item) {
          return item[attribute];
        });
      });
    };

    //////////////////////
    /// Utils
    //////////////////////

    function to_utc_epoch_seconds(date) {
      date = kbn.parseDate(date);
      return date.getTime();
    }

    // Convert 'now' to timestamp
    function to_iso8601(date) {
      if (_.isString(date)) {
        if (date === 'now') {
          return 'now';
        }
        else if (date.indexOf('now') >= 0) {
          date = date.substring(3);
          date = date.replace('m', 'min');
          date = date.replace('M', 'mon');
          return date;
        }
        date = kbn.parseDate(date);
      }

      date = moment.utc(date);
      return date.toISOString();
    }

    /////////////////////////////////////////
    /// UNUSED METHOD, KEYSTONE STUFFS
    /////////////////////////////////////////

    GnocchiDatasource.prototype.ensure_authentified = function(deferred, callback) {
      var self = this;
      if (self.url == null){
        return self.get_token(callback);
      } else {
        return callback().then(undefined, function(reason) {
          if (reason.status === 401) {
            return self.get_token(callback);
          } else if (reason.status !== 0 || reason.status >= 300) {
            if (reason.data && reason.data.error) {
              reason.message = 'Gnocchi Error Response: ' + reason.data.error;
            } else {
              reason.message = 'Gnocchi Error: ' + reason.message;
            }
            deferred.reject(reason);
          }
        });
      }
    };

    GnocchiDatasource.prototype.get_token = function(callback) {
      var options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        url: this.keystone_endpoint + '/v3/auth/tokens',
        data: { "auth": {
          "identity": {
            "methods": ["password"],
            "password": { "user": {
              "name": this.username,
              "password": this.password,
              "domain": { "id": "default"  } }}},
              "scope": { "project": {
                "domain": { "id": "default" },
                "name": this.username}}
        }}
      };
      var self = this;
      backendSrv.datasourceRequest(options).then(function(result) {
        self.token = result.headers('X-Subject-Token');
        _.each(result.data['token']['catalog'], function(service) {
          if (service['type'] === 'metric') {
            _.each(service['endpoints'], function(endpoint) {
              if (endpoint['interface'] === 'public') {
                self.url = endpoint['url'];
                callback();
              }
            });
          }
        });
      });
    };

    return GnocchiDatasource;
  });

});
