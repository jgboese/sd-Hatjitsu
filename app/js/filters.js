/* global angular */

'use strict';

/* Filters */

angular
  .module('pokerApp.filters', [])
  .filter('interpolate', [
    'version',
    (version) => (text) => String(text).replace(/%VERSION%/gm, version),
  ]);
