/* global angular, io, $ */

'use strict';

/* Services */

const pokerAppServices = angular.module('pokerApp.services', []);

pokerAppServices.value('version', '0.1');

pokerAppServices.factory('socket', [
  '$rootScope',
  ($rootScope) => {
    const socket = io({
      reconnectionDelay: 500,
      reconnectionAttempts: 10,
    });

    $rootScope.socketMessage = 'Connecting...';
    $rootScope.activity = false;
    $rootScope.sessionId = null;

    const showSocketMessage = (message) => {
      $rootScope.$apply(() => {
        $rootScope.socketMessage = message;
      });
    };

    socket.on('connect_error', (error) => {
      showSocketMessage(`:-(  Error = ${error.message}`);
    });
    socket.on('disconnect', () => {
      showSocketMessage(':-(  Disconnected');
    });
    socket.io.on('reconnect_attempt', () => {
      showSocketMessage('Reconnecting...');
    });
    socket.io.on('reconnect', () => {
      showSocketMessage(null);
    });
    socket.io.on('reconnect_failed', () => {
      showSocketMessage(':-( Reconnect failed');
    });
    socket.on('connect', () => {
      $rootScope.$apply(() => {
        $rootScope.socketMessage = null;
        if (!$.cookie('sessionId')) {
          $.cookie('sessionId', socket.id);
        }
        $rootScope.sessionId = $.cookie('sessionId');
      });
    });

    return {
      on(eventName, callback) {
        $rootScope.socketMessage = null;
        socket.on(eventName, (...args) => {
          $rootScope.$apply(() => {
            callback.apply(socket, args);
          });
        });
      },
      emit(eventName, data, callback) {
        $rootScope.activity = true;
        socket.emit(eventName, data, (...args) => {
          $rootScope.$apply(() => {
            $rootScope.activity = false;
            if (callback) {
              callback.apply(socket, args);
            }
          });
        });
      },
    };
  },
]);
