/* The year box: type a year, or pick one of the seven most recent.

   Owner instruction, 2026-10-19, in person: tapping the year "should open a
   drop down menu showing only 7 years starting in the current year, it should
   also allow them to type the year their vehicle is from." A <select> can do
   neither, so this is a text box with a list of our own under it.

   The real answer still lives in the hidden <select id="m-year">, which
   app.js fills (1981 to next year), reads, and resets. Everything here writes
   THROUGH that select and fires its change event, so app.js never knew
   anything changed. Two things it does to the select directly, and why:

   - Its value setter is wrapped, so when app.js clears the year (closing the
     manual route, starting over) the text box clears with it. Programmatic
     value changes fire no event, so there was nothing else to listen to.
   - Its focus() is redirected here, because app.js focuses the year when the
     route opens, and focusing a hidden select would put the caret nowhere. */

(function () {
  'use strict';

  var sel = document.getElementById('m-year');
  var input = document.getElementById('m-year-in');
  var list = document.getElementById('m-year-list');
  if (!sel || !input || !list) return;

  var SHOWN = 7;
  var active = -1;     // index of the highlighted row, for the keyboard
  var rows = [];

  /* Every year app.js offered, newest first, as strings. Read fresh each time:
     the options are filled when the manual route opens, not at load. */
  function years() {
    var out = [];
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value) out.push(sel.options[i].value);
    }
    return out;
  }

  /* With nothing typed: this year and the six before it, per the owners. Next
     year's models are already on sale by autumn and are still in the select,
     so typing one works; it is just not in the short list. With digits typed:
     the newest seven years that start with them. */
  function matches(text) {
    if (!text) {
      var now = new Date().getFullYear();
      var out = [];
      for (var y = now; y > now - SHOWN; y--) out.push(String(y));
      return out.filter(function (v) { return years().indexOf(v) !== -1; });
    }
    return years().filter(function (v) { return v.indexOf(text) === 0; }).slice(0, SHOWN);
  }

  function render() {
    var text = input.value.replace(/\D/g, '');
    var found = matches(text);
    list.innerHTML = '';
    rows = [];
    active = -1;

    if (!found.length) {
      var li = document.createElement('li');
      li.className = 'yearbox__empty';
      li.textContent = text.length === 4
        ? 'We don’t have ' + text + ' listed. Try a year from 1981 on.'
        : 'No years start with ' + text + '.';
      list.appendChild(li);
      return;
    }

    found.forEach(function (v, i) {
      var li = document.createElement('li');
      li.className = 'yearbox__opt';
      li.id = 'm-year-opt-' + v;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(sel.value === v));
      li.textContent = v;
      li.addEventListener('click', function () { choose(v); });
      list.appendChild(li);
      rows.push(li);
    });
  }

  function open() {
    if (input.disabled) return;
    render();
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  /* Write the answer through the select, and tell app.js, only if it changed:
     a change event resets make and model, so firing it for nothing would throw
     away answers the customer already gave. */
  function commit(v) {
    if (sel.value === v) return;
    setSel(v);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function choose(v) {
    input.value = v;
    commit(v);
    close();
  }

  function highlight(i) {
    rows.forEach(function (r, j) { r.classList.toggle('is-active', j === i); });
    active = i;
    if (rows[i]) {
      input.setAttribute('aria-activedescendant', rows[i].id);
      rows[i].scrollIntoView({ block: 'nearest' });
    }
  }

  /* Opens on a tap or click, not on focus: app.js focuses this box itself when
     the route opens on a laptop, and a list springing open unasked is noise.
     The keyboard opens it with the down arrow, below. */
  input.addEventListener('click', open);

  input.addEventListener('input', function () {
    /* Digits only, at most four: no maxlength on the box, because that cut a
       pasted "abc2027x" down to "abc2" BEFORE the letters came out. */
    var text = input.value.replace(/\D/g, '').slice(0, 4);
    if (text !== input.value) input.value = text;
    /* A whole, known year typed is an answer; anything less is not one yet,
       so the select is emptied and make and model wait. */
    commit(text.length === 4 && years().indexOf(text) !== -1 ? text : '');
    if (sel.value) { close(); return; }
    open();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) open();
      if (!rows.length) return;
      var step = e.key === 'ArrowDown' ? 1 : -1;
      highlight((active + step + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      if (!list.hidden && rows[active]) { e.preventDefault(); choose(rows[active].textContent); }
    } else if (e.key === 'Escape') {
      close();
    }
  });

  /* A tap on the list must land before the box loses focus and shuts it. */
  list.addEventListener('mousedown', function (e) { e.preventDefault(); });

  input.addEventListener('blur', function () {
    /* Typed but not finished ("201"): the box would claim a year the quote
       does not have, so it goes back to the real answer. */
    if (input.value !== sel.value) input.value = sel.value;
    close();
  });

  /* The two hooks into the select described at the top. */
  var proto = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  function setSel(v) { proto.set.call(sel, v); }
  Object.defineProperty(sel, 'value', {
    configurable: true,
    get: function () { return proto.get.call(sel); },
    set: function (v) {
      proto.set.call(sel, v);
      if (document.activeElement !== input) input.value = proto.get.call(sel);
    }
  });
  sel.focus = function () { input.focus(); };
})();
