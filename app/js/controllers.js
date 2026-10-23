/* global angular, _, $, ScrollIntoView, DropDown */
/* exported MainCtrl, LobbyCtrl, RoomCtrl */

'use strict';

/* Controllers */

function MainCtrl($scope, $timeout) {
  $scope.logoState = '';
  $scope.errorMessage = null;
  $scope.message = null;

  $scope.$on('$routeChangeSuccess', () => {
    $scope.logoState = '';
    $scope.bodyState = '';
  });
  $scope.$on('unanimous vote', () => {
    $scope.logoState = ' header__logo--green';
    $scope.bodyState = ' body--green';
  });
  $scope.$on('not unanimous vote', () => {
    $scope.logoState = ' header__logo--yellow';
    $scope.bodyState = ' body--yellow';
  });
  $scope.$on('problem vote', () => {
    $scope.logoState = ' header__logo--red';
    $scope.bodyState = ' body--red';
  });
  $scope.$on('unfinished vote', () => {
    $scope.logoState = '';
    $scope.bodyState = '';
  });

  $scope.$on('show message', (evnt, msg) => {
    $scope.message = msg;
    $timeout(() => {
      $scope.message = null;
    }, 4000);
  });
  $scope.$on('show error', (evnt, msg) => {
    $scope.errorMessage = msg;
    $timeout(() => {
      $scope.errorMessage = null;
    }, 3000);
  });
}

MainCtrl.$inject = ['$scope', '$timeout'];

function LobbyCtrl($scope, $location, socket) {
  $scope.disableButtons = false;
  $scope.createRoom = () => {
    $scope.disableButtons = true;
    socket.emit('create room', {}, (roomUrl) => {
      $location.path(roomUrl);
    });
  };
  $scope.enterRoom = (room) => {
    $scope.disableButtons = true;
    socket.emit('room info', { roomUrl: room }, (response) => {
      if (response.error) {
        $scope.disableButtons = false;
        $scope.$emit('show error', response.error);
      } else {
        $location.path(response.roomUrl);
      }
    });
  };
}

LobbyCtrl.$inject = ['$scope', '$location', 'socket'];

function standardDeviation(values, avg) {
  const squareDiffs = values.map((value) => {
    const diff = value - avg;
    return diff * diff;
  });
  return Math.sqrt(average(squareDiffs));
}

function average(data) {
  const sum = data.reduce((total, value) => total + value, 0);
  return sum / data.length;
}

function cardValue(vote) {
  if (vote.match(/^[0-9]+$/)) {
    return parseFloat(vote);
  } else if (vote === '½') {
    return 0.5;
  } else if (vote === 'A♠') {
    return 1;
  } else if (vote === '♔') {
    return 13;
  }
  return undefined;
}

// Server broadcasts that mean "the room changed, fetch it again"
const ROOM_UPDATE_EVENTS = [
  'room joined',
  'room left',
  'card pack set',
  'voter status changed',
  'voted',
  'unvoted',
  'vote reset',
  'reveal',
];

function RoomCtrl($scope, $routeParams, $timeout, socket) {
  const processMessage = (response, process) => {
    if (response.error) {
      $scope.$emit('show error', response.error);
    } else {
      (process || angular.noop)(response);
    }
  };

  // wipe out vote if voting state is not yet finished to prevent cheating.
  // if it has already been set - use the actual vote. This works for unvoting - so that
  // before the flip occurs - we don't display 'oi'
  const processVotes = () => {
    const voteCount = $scope.votes.length;
    _.each($scope.votes, (v) => {
      v.visibleVote =
        v.visibleVote === undefined &&
        !$scope.forcedReveal &&
        voteCount < $scope.voterCount
          ? 'oi!'
          : v.vote;
    });
    const voteArr = [];
    voteArr.length = $scope.voterCount - voteCount;
    $scope.placeholderVotes = voteArr;

    const cardValues = _.filter(
      _.map(_.pluck($scope.votes, 'vote'), cardValue),
      _.isNumber,
    );
    $scope.votingAverage = average(cardValues);
    $scope.votingStandardDeviation = standardDeviation(
      cardValues,
      $scope.votingAverage,
    ).toFixed(2);
    $scope.showAverage = voteArr.length === 0 && cardValues.length > 0;

    $scope.forceRevealDisable = !(
      !$scope.forcedReveal &&
      ($scope.votes.length < $scope.voterCount || $scope.voterCount === 0)
    );
    $scope.sortVotesDisable =
      !$scope.forceRevealDisable || $scope.alreadySorted;

    if ($scope.votes.length === $scope.voterCount || $scope.forcedReveal) {
      if ($scope.alreadySorted) {
        $scope.votes = $scope.votes.sort(
          (el1, el2) =>
            $scope.cards.indexOf(el1.vote) - $scope.cards.indexOf(el2.vote),
        );
      }

      const uniqVotes = _.chain($scope.votes)
        .pluck('vote')
        .uniq()
        .value().length;
      if (uniqVotes === 1) {
        $scope.$emit('unanimous vote');
      } else if (uniqVotes === $scope.voterCount) {
        $scope.$emit('problem vote');
      } else if ($scope.voterCount > 3 && uniqVotes === $scope.voterCount - 1) {
        $scope.$emit('problem vote');
      } else {
        $scope.$emit('not unanimous vote');
      }
    } else {
      $scope.$emit('unfinished vote');
    }
  };

  const myConnectionHash = () =>
    _.find($scope.connections, (c) => c.sessionId === $scope.sessionId);

  const myVoteHash = () =>
    _.find($scope.votes, (c) => c.sessionId === $scope.sessionId);

  const haveIVoted = () => $scope.myVote != null;

  const votingFinished = () =>
    $scope.forcedReveal || $scope.votes.length === $scope.voterCount;

  const setVotingState = () => {
    $scope.cardsState =
      votingFinished() || !$scope.voter ? ' card--disabled' : '';
    $scope.votingState = votingFinished() ? ' flipped-stagger' : '';
  };

  const setLocalVote = (vote) => {
    const voteHash = myVoteHash();
    $scope.myVote = vote;
    $scope.voted = haveIVoted();
    if (!voteHash) {
      // initialize connections array with my first vote. (just to speed up UI)
      $scope.votes.push({ sessionId: $scope.sessionId, vote });
    } else if (vote) {
      voteHash.vote = vote;
    } else {
      // we're unvoting - lets remove it from the votes.
      $scope.votes = _.filter(
        $scope.votes,
        (v) => v.sessionId !== $scope.sessionId,
      );
    }
    processVotes();
    setVotingState();
    $scope.scrollToSelectedCards.now();
  };

  const chooseCardPack = (val) => {
    const fib = [
      '0',
      '1',
      '2',
      '3',
      '5',
      '8',
      '13',
      '21',
      '34',
      '55',
      '89',
      '?',
    ];
    const goat = [
      '0',
      '½',
      '1',
      '2',
      '3',
      '5',
      '8',
      '13',
      '20',
      '40',
      '100',
      '?',
      '☕',
    ];
    const seq = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '?'];
    const play = ['A♠', '2', '3', '5', '8', '♔'];
    const tshirt = ['XL', 'L', 'M', 'S', 'XS', '?'];
    switch (val) {
      case 'fib':
        return fib;
      case 'goat':
        return goat;
      case 'seq':
        return seq;
      case 'play':
        return play;
      case 'tshirt':
        return tshirt;
      default:
        return [];
    }
  };

  const refreshRoomInfo = (roomObj) => {
    if (roomObj.createAdmin) {
      $.cookie(`admin-${roomObj.roomUrl}`, true);
    }
    if ($.cookie(`admin-${roomObj.roomUrl}`)) {
      $scope.showAdmin = true;
    }

    $scope.connections = roomObj.connections;
    $scope.humanCount = $scope.connections.length;
    $scope.cardPack = roomObj.cardPack;
    $scope.forcedReveal = roomObj.forcedReveal;
    $scope.alreadySorted = roomObj.alreadySorted;
    $scope.cards = chooseCardPack($scope.cardPack);

    $scope.votes = _.chain($scope.connections)
      .filter((c) => c.vote)
      .values()
      .value();
    $scope.voterCount = _.filter($scope.connections, (c) => c.voter).length;

    const connection = myConnectionHash();

    if (connection) {
      $scope.voter = connection.voter;
      $scope.myVote = connection.vote;
      $scope.voted = haveIVoted();
    }

    processVotes();

    // we first want the cards to be displayed as hidden, and then apply the finished state
    // if voting has finished - which then actions the transition.
    $timeout(() => {
      setVotingState();
    }, 100);
  };

  const refreshRoom = () => {
    socket.emit('room info', { roomUrl: $scope.roomId }, (response) => {
      processMessage(response, refreshRoomInfo);
    });
  };

  const joinRoom = () => {
    socket.emit(
      'join room',
      { roomUrl: $scope.roomId, sessionId: $scope.sessionId },
      (response) => {
        processMessage(response, refreshRoomInfo);
      },
    );
  };

  $scope.configureRoom = () => {
    ROOM_UPDATE_EVENTS.forEach((eventName) => {
      socket.on(eventName, refreshRoom);
    });
    socket.on('card pack set', () => {
      $scope.$emit('show message', 'Card pack changed...');
    });

    // On every (re)connect, rejoin under the session id the socket service stored in a cookie
    socket.on('connect', () => {
      $scope.sessionId = $.cookie('sessionId');
      joinRoom();
    });

    joinRoom();
  };

  $scope.setCardPack = (cardPack) => {
    $scope.cardPack = cardPack;
    $scope.resetVote();

    socket.emit('set card pack', { roomUrl: $scope.roomId, cardPack });
  };

  $scope.vote = (vote) => {
    if ($scope.myVote !== vote) {
      if (!votingFinished() && $scope.voter) {
        setLocalVote(vote);

        socket.emit(
          'vote',
          { roomUrl: $scope.roomId, vote, sessionId: $scope.sessionId },
          (response) => {
            processMessage(response);
          },
        );
      }
    }
  };

  $scope.unvote = (sessionId) => {
    if (sessionId === $scope.sessionId) {
      if (!votingFinished()) {
        setLocalVote(undefined);

        socket.emit(
          'unvote',
          { roomUrl: $scope.roomId, sessionId: $scope.sessionId },
          (response) => {
            processMessage(response);
          },
        );
      }
    }
  };

  $scope.resetVote = () => {
    socket.emit('reset vote', { roomUrl: $scope.roomId }, (response) => {
      processMessage(response);
    });
  };

  $scope.forceReveal = () => {
    $scope.forceRevealDisable = true;
    socket.emit('force reveal', { roomUrl: $scope.roomId }, (response) => {
      processMessage(response);
    });
  };

  $scope.sortVotes = () => {
    $scope.sortVotesDisable = true;
    socket.emit('sort votes', { roomUrl: $scope.roomId }, (response) => {
      processMessage(response);
    });
  };

  $scope.toggleVoter = () => {
    socket.emit(
      'toggle voter',
      {
        roomUrl: $scope.roomId,
        voter: $scope.voter,
        sessionId: $scope.sessionId,
      },
      (response) => {
        processMessage(response);
      },
    );
  };

  $scope.roomId = $routeParams.roomId;
  $scope.humanCount = 0;
  $scope.voterCount = 0;
  $scope.showAdmin = false;
  $scope.voter = true;
  $scope.connections = {};
  $scope.votes = [];
  $scope.cardPack = '';
  $scope.myVote = undefined;
  $scope.voted = haveIVoted();
  $scope.votingState = '';
  $scope.forcedReveal = false;
  $scope.forceRevealDisable = true;
  $scope.sortVotesDisable = true;
  $scope.scrollToSelectedCards = new ScrollIntoView($('#chosenCards'));

  $scope.dropDown = new DropDown('#dd');
  $scope.votingAverage = 0;
}

RoomCtrl.$inject = ['$scope', '$routeParams', '$timeout', 'socket'];
