define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('GnocchiQueryCtrl', function($scope, $timeout) {

    $scope.init = function() {
      $scope.target.errors = validateTarget($scope.target);
      // TODO(sileht): Allows custom
      $scope.aggregators = ['mean', 'sum', 'min', 'max'];

      if (!$scope.target.aggregator) {
        $scope.target.aggregator = 'mean';
      }

      $scope.$on('typeahead-updated', function() {
        $timeout($scope.targetBlur);
      });

      if (!$scope.target.queryMode) {
        //$scope.target.queryMode = "resource_search";
        $scope.target.queryMode = "resource_aggregation";
      }
    };

    $scope.suggestMetrics = function(query, callback) {
      $scope.datasource
        .performSuggestQuery(query, 'metrics')
        .then(callback);
    };

    $scope.targetBlur = function() {
      $scope.target.errors = validateTarget($scope.target);

      // this does not work so good
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };

    $scope.toggleQueryMode = function () {
      var mode = [
        "resource_search", "resource_aggregation",
        "metric",
      ];
      var index = mode.indexOf($scope.target.queryMode) + 1;
      if (index === mode.length) {
        index = 0;
      }
      $scope.target.queryMode = mode[index];
    };

    function validateTarget(target) {
      target;
      var errs = {};
      return errs;
    }

  });

});
