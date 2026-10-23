/* global $ */
/* exported DropDown, ScrollIntoView */

'use strict';

$(() => {
  $('.no-js-hide').removeClass('no-js-hide');
});

function DropDown(el) {
  this.dd = el;
  this.val = '';
  this.initEvents();
}
DropDown.prototype = {
  initEvents() {
    const obj = this;
    $(document).on('click', this.dd, function () {
      $(this).toggleClass('active');
      return false;
    });
    $(document).on('click', '.dropdown > li', function () {
      $('span', obj.dd).text(`${$(this).text()} pack`);
    });
    $(document).click(() => {
      $('.dropdown-wrapper', obj.dd).removeClass('active');
    });
  },
};

function ScrollIntoView(el) {
  this.el = el;
}
ScrollIntoView.prototype = {
  now() {
    $('body').animate({ scrollTop: this.el.offset().top }, 'slow');
  },
};
