/* global angular */

'use strict';

/* Directives */

// AngularJS 1.0 infers dependencies by parsing `function (...)` source, which fails on arrow
// functions, so everything passed to the injector uses the array annotation, even with no deps.
angular
  .module('pokerApp.directives', [])
  .directive('appVersion', [
    'version',
    (version) => (scope, elm) => {
      elm.text(version);
    },
  ])
  .directive('cardvalue', [
    () => (scope, elm) => {
      const value = scope.card || scope.vote.vote;
      const code = isNaN(parseInt(value, 10)) ? value.charCodeAt() : value;
      elm.addClass(`card--${code}`);
    },
  ])
  .directive('selectedvote', [
    () => (scope, elm) => {
      if (scope.vote.sessionId === scope.sessionId) {
        elm.addClass('card--selected');
      }
    },
  ]);
