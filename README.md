==================================
grafana2-gnocchi-datasource-plugin
==================================

Grafana 2 - Gnocchi datasource Plugin
=====================================

This is a plugin that allows Grafana 2 to support Gnocchi as datasource

Installation
============

Copy all files into <grafana_installation_directory>/public/app/plugins/datasource/gnocchi

Tests
=====

    npm install
    npm install -g grunt-cli
    grunt

Implemented
===========

* Getting measures of a metric with the metric_id
* Getting measures of multiple resources with a search query and a metric name

Not yet implemented
===================

* Getting measures of metric with the resource id and the metric name
* Getting measures from a cross aggregation query

Current Limitation
==================

Grafana doesn’t allow to query two different servers when using the proxymode
So we are not able to query Keystone for a token and then query gnocchi.

In proxymode, we need to set a token and the Gnocchi url on the datasource

In directmode (Not work yet), we can use login/password and the Keystone url. 
Note that CORS must be enabled on Keystone and Gnocchi servers.


License
=======

APACHE LICENSE Version 2.0, January 2004
