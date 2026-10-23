/* global Modernizr */

'use strict';

Modernizr.addTest('checked', () =>
  Modernizr.testStyles(
    '#modernizr div {width:10px;} #modernizr input:checked ~ div {width: 20px;}',
    (elem) => {
      const chx = document.createElement('input');
      const div = document.createElement('div');

      chx.setAttribute('type', 'checkbox');
      chx.setAttribute('checked', 'checked');
      elem.appendChild(chx);
      elem.appendChild(div);

      return elem.lastChild.offsetWidth > 10;
    },
  ),
);

Modernizr.load([
  {
    test: Modernizr.mq('only all'),
    nope: '/lib/respond.min.js',
  },
]);
