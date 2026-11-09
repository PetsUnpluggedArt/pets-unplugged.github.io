/* Pets Unplugged: small page helpers. Everything works without this file; it only adds the extras. */
(function () {
  'use strict';

  // Mobile menu
  var btn = document.querySelector('[data-menu]');
  var nav = document.getElementById('mnav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      nav.hidden = open;
    });
  }

  // Color-in slider: the range input moves the edge of the colored picture
  document.querySelectorAll('[data-slider]').forEach(function (fig) {
    var box = fig.querySelector('.slider-box');
    var input = fig.querySelector('input[type=range]');
    if (!box || !input) return;
    var set = function () { box.style.setProperty('--pct', input.value + '%'); };
    input.addEventListener('input', set);
    set();
  });

  // Filter buttons (books: Dogs/Cats/Holidays/Seasons, merch: kinds)
  document.querySelectorAll('[data-filters]').forEach(function (group) {
    var list = document.getElementById(group.getAttribute('data-filters'));
    if (!list) return;
    var status = document.getElementById(group.getAttribute('data-status'));
    group.querySelectorAll('button[data-f]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-f');
        group.querySelectorAll('button[data-f]').forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        var shown = 0;
        list.querySelectorAll('[data-tags]').forEach(function (item) {
          var on = f === 'All' || (' ' + item.getAttribute('data-tags') + ' ').indexOf(' ' + f + ' ') >= 0;
          item.hidden = !on;
          if (on) shown++;
        });
        if (status) status.textContent = shown + (shown === 1 ? ' page' : ' pages') + ' shown';
      });
    });
  });

  // Episode tabs (pet stories)
  document.querySelectorAll('[role=tablist][data-eps]').forEach(function (tl) {
    var tabs = Array.prototype.slice.call(tl.querySelectorAll('[role=tab]'));
    var pick = function (t, focus) {
      tabs.forEach(function (o) {
        var on = o === t;
        o.setAttribute('aria-selected', on ? 'true' : 'false');
        o.tabIndex = on ? 0 : -1;
        var p = document.getElementById(o.getAttribute('aria-controls'));
        if (p) p.hidden = !on;
      });
      if (focus) t.focus();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { pick(t, false); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, j = -1;
        if (k === 'ArrowDown' || k === 'ArrowRight') j = (i + 1) % tabs.length;
        if (k === 'ArrowUp' || k === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        if (k === 'Home') j = 0;
        if (k === 'End') j = tabs.length - 1;
        if (j >= 0) { e.preventDefault(); pick(tabs[j], true); }
      });
    });
  });

  // Free video preview: load the Vimeo player only when asked
  document.querySelectorAll('[data-vimeo]').forEach(function (b) {
    b.addEventListener('click', function () {
      var box = document.getElementById(b.getAttribute('aria-controls'));
      if (!box) return;
      var src = 'https://player.vimeo.com/video/' + b.getAttribute('data-vimeo') + '?autoplay=1&loop=1&title=0&byline=0&portrait=0&dnt=1';
      var h = b.getAttribute('data-hash');
      if (h) src += '&h=' + h;
      var wrap = document.createElement('div');
      wrap.className = 'vframe';
      var f = document.createElement('iframe');
      f.src = src;
      f.title = b.getAttribute('data-title') || 'Video';
      f.allow = 'autoplay; fullscreen; picture-in-picture';
      f.setAttribute('allowfullscreen', '');
      wrap.appendChild(f);
      box.innerHTML = '';
      box.appendChild(wrap);
      f.focus();
    });
  });

  // Sign-up forms (Brevo). Same steps as Brevo's own embed: a reCAPTCHA v3 token in
  // "g-recaptcha-response", then the form is posted to its action with ?isAjax=1 and Brevo answers in JSON.
  // Google's script loads only once someone starts filling in a form.
  var brevo = document.querySelectorAll('form[data-brevo]');
  var capLoading = false;
  var loadCaptcha = function (key) {
    if (capLoading || !key) return;
    capLoading = true;
    var s = document.createElement('script');
    s.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(key) + '&hl=en';
    s.async = true;
    document.head.appendChild(s);
  };
  brevo.forEach(function (form) {
    var key = form.getAttribute('data-sitekey');
    var msg = form.querySelector('.form-msg');
    var btn = form.querySelector('[type=submit]');
    var say = function (text, ok) {
      if (!msg) return;
      msg.textContent = text;
      msg.className = 'form-msg ' + (ok ? 'ok' : 'bad');
      msg.hidden = false;
    };
    form.addEventListener('focusin', function () { loadCaptcha(key); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      if (btn) btn.disabled = true;
      var send = function () {
        var x = new XMLHttpRequest();
        x.open('POST', form.getAttribute('action') + '?isAjax=1');
        x.onload = function () {
          var r = {};
          try { r = JSON.parse(x.responseText); } catch (err) { r = {}; }
          if (x.status >= 200 && x.status < 300 && r.success !== false) {
            say("You're on the list. Thank you! Check your inbox in case we ask you to confirm.", true);
            form.reset();
          } else {
            say((r.message || "That didn't go through.") + ' Please try again, or email hello@petsunplugged.com.', false);
          }
          if (btn) btn.disabled = false;
        };
        x.onerror = function () {
          say("We couldn't reach the sign-up service. Please try again in a minute.", false);
          if (btn) btn.disabled = false;
        };
        x.send(new FormData(form));
      };
      if (!key) { send(); return; }
      loadCaptcha(key);
      var tries = 0;
      var withToken = function () {
        if (!(window.grecaptcha && window.grecaptcha.ready)) {
          if (++tries > 50) { send(); return; } // 5 s: send anyway and let Brevo answer
          setTimeout(withToken, 100);
          return;
        }
        window.grecaptcha.ready(function () {
          window.grecaptcha.execute(key, { action: 'submit' }).then(function (token) {
            var t = form.querySelector('input[name="g-recaptcha-response"]');
            if (!t) {
              t = document.createElement('input');
              t.type = 'hidden';
              t.name = 'g-recaptcha-response';
              form.appendChild(t);
            }
            t.value = token;
            send();
          }, send);
        });
      };
      withToken();
    });
  });
})();
