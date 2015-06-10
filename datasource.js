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

  module.config(function($httpProvider) {
    //Enable cross domain calls
    $httpProvider.defaults.useXDomain = true;
  });

  module.factory('GnocchiDatasource', function($q, backendSrv, templateSrv) {

    function GnocchiDatasource(datasource) {
      this.type = 'gnocchi';
      this.name = datasource.name;
      this.project = datasource.jsonData.project;
      this.username = datasource.jsonData.username;
      this.password = datasource.jsonData.password;

      if (datasource.url.indexOf('http') === 0){
        this.url = null;
        this.keystone_endpoint = sanitize_url(datasource.url);
      } else {
        this.url = sanitize_url(datasource.url);
        this.keystone_endpoint = null;
      }

      this.default_headers = {
        'Content-Type': 'application/json',
        'X-Auth-Token': datasource.jsonData.token,
      }

      this.supportMetrics = true;
      this.editorSrc = 'app/features/gnocchi/partials/query.editor.html';
    }

    ////////////////
    // Plugins API
    ////////////////

    GnocchiDatasource.prototype.query = function(options) {
      if (this.keystone_endpoint === null){
        return this.do_query(options);
      } else {
        var deferred = $q.defer();
        var self = this;
        this.ensure_authentified(deferred, function() {
          return self.do_query(options);
        });
        return deferred.promise;
      }
    };

    GnocchiDatasource.prototype.performSuggestQuery = function(query, type) {
      // handle only type == 'metrics'
      var options = {
          method: 'GET',
          headers: this.default_headers,
      };
      var attribute = "id";
      if (type === 'metrics') {
        options.url = this.url + 'v1/metric';
      }
      return backendSrv.datasourceRequest(options).then(function(result) {
        return _.map(result.data, function(item) {
          return item[attribute];
        });
      });
    };

    GnocchiDatasource.prototype.metricFindQuery = function(query) {
      console.log(query);
      return {};
      var interpolated;
      try {
        interpolated = encodeURIComponent(templateSrv.replace(query));
      }
      catch(err) {
        return $q.reject(err);
      }

      return this.doGraphiteRequest({method: 'GET', url: '/metrics/find/?query=' + interpolated })
        .then(function(results) {
          return _.map(results.data, function(metric) {
            return {
              text: metric.text,
              expandable: metric.expandable ? true : false
            };
          });
        });
    };

    GnocchiDatasource.prototype.testDatasource = function() {
      if (this.keystone_endpoint === null){
        return this.do_testDatasource();
      } else {
        var deferred = $q.defer();
        var self = this;
        this.ensure_authentified(deferred, function() {
          return self.do_testDatasource();
        });
        return deferred.promise;
      }
    };

    GnocchiDatasource.prototype.do_testDatasource = function() {
      var resource_search_req = {
        url: this.url,
        method: 'GET',
        headers: this.default_headers,
      };
      return backendSrv.datasourceRequest(resource_search_req).then(function (result) {
        if (result.status === 200){
          return { status: "success", message: "Data source is working", title: "Success" };
        } else if (result.status === 401) {
          return { status: "failure", message: "Data source authentification fail", title: "Failure" };
        } else {
          return { status: "failure", message: "Data source won't work:" + result.data, title: "Failure" };
        }
      });
    };

    ////////////////
    /// Query
    ////////////////

    GnocchiDatasource.prototype.validateSearchTarget = function(target) {
          var resource_search_req = {
            url: this.url + 'v1/search/resource/instance',
            method: 'POST',
            headers: this.default_headers,
            data: target.resource_search,
          };
          return backendSrv.datasourceRequest(resource_search_req);
    }


    GnocchiDatasource.prototype.do_query = function(options) {
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
            url: self.url + 'v1/search/resource/instance',
            method: 'POST',
            headers: self.default_headers,
            data: target.resource_search,
          };
          return backendSrv.datasourceRequest(resource_search_req).then(function(result) {
            var promise = _.map(result.data, function(resource) {
              var measures_req = _.merge({}, default_measures_req);
              measures_req.url = (self.url + 'v1/resource/' + (target.resource_type || 'generic') +
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
          default_measures_req.url = (self.url + 'v1/aggregation/resource/' +
                                      (target.resource_type || 'generic') + '/metric/' + target.metric_name);
          default_measures_req.method = 'POST';
          default_measures_req.data = target.resource_search;
          return retrieve_measures(target.label || "unlabeled", default_measures_req);

        } else if (target.queryMode === "resource") {
          default_measures_req.url = (self.url + 'v1/resource/' + target.resource_type + '/' +
                                      target.resource_id + '/metric/' + target.metric_name+ '/measures');
          return retrieve_measures(target.resource_id, default_measures_req);

        } else if (target.queryMode === "metric") {
          default_measures_req.url = self.url + 'v1/metric/' + target.metric_id + '/measures';
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

    //////////////////////
    /// Utils
    //////////////////////

    function to_utc_epoch_seconds(date) {
      date = kbn.parseDate(date);
      return date.getTime();
    }

    // Convert grafana format to gnocchi format
    function to_iso8601(date) {
      var parsed_date;
      if (_.isString(date)) {
        if (date === 'now') {
          parsed_date = moment.utc();
        } else if (date.indexOf('now') >= 0) {
          parsed_date = moment.utc();
          var delta = date.substring(3);
          var method;
          if (delta.indexOf('-') === 0) {
            delta = delta.substring(1);
            method = function(a, u) { parsed_date.subtract(a, u); };
          } else {
            method = function(a, u) { parsed_date.add(a, u); };
          }
          var amount = parseInt(delta.slice(0, delta.length-1));
          var unit = delta.slice(delta.length-1, delta.length);
          method(amount, unit);
        } else {
          parsed_date = moment.utc(kbn.parseDate(date));
        }
      } else {
        parsed_date = moment.utc(date);
      }
      return parsed_date.toISOString();
    }

    function sanitize_url(url) {
        if (url[url.length - 1] !== '/') {
          return url + '/';
        } else {
          return url;
        }
    }

    //////////////////////
    /// KEYSTONE STUFFS
    //////////////////////

    GnocchiDatasource.prototype.ensure_authentified = function(deferred, callback) {
      var self = this;
      if (self.url == null){
        return self.get_token(callback);
      } else {
        return callback().then(undefined, function(reason) {
          if (reason.status === 401) {
            return self.get_token(callback);
          } else if (reason.status !== 0 || reason.status >= 300) {
            reason.message = 'Gnocchi Error: ' + reason.message;
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
        url: this.keystone_endpoint + 'v3/auth/tokens',
        data: {
          "auth": {
            "identity": {
              "methods": ["password"],
              "password": {
                "user": {
                  "name": this.username,
                  "password": this.password,
                  "domain": { "id": "default"  }
                }
              }
            },
            "scope": {
              "project": {
                "domain": { "id": "default" },
                "name": this.project,
              }
            }
          }
        }
      };
      var self = this;
      backendSrv.datasourceRequest(options).then(function(result) {
        if (result.status !== 201) {
          console.log("Invalid credential")
          return;
        }
        console.log(result.headers())
        self.default_headers['X-Auth-Token'] = result.headers('X-Subject-Token');
        _.each(result.data['token']['catalog'], function(service) {
          if (service['type'] === 'metric') {
            _.each(service['endpoints'], function(endpoint) {
              if (endpoint['interface'] === 'public') {
                self.url = sanitize_url(endpoint['url']);
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
