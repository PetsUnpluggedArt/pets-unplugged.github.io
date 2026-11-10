/* Pets Unplugged: languages. Everything works without this file.
   - Clicking a language (the EN / DE / FR / ES switcher or the suggestion below) remembers the choice in this browser.
   - On the QR video pages (body[data-qr]), a visitor whose browser prefers German, French or Spanish gets a small
     suggestion to watch in that language. Nothing happens by itself the first time: no automatic redirect, so search
     engines and anyone who wants English stay on the page they opened.
   - Only after someone has picked a language themselves does a QR page open straight in that language next time.
     The switcher on every page changes (or undoes) that choice. */
(function () {
  'use strict';
  var KEY = 'pu_lang';
  var LANGS = ['en', 'de', 'fr', 'es'];
  var store = {
    get: function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set: function (v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: nothing to remember */ } }
  };
  var here = (document.documentElement.getAttribute('lang') || 'en').slice(0, 2);

  // remember explicit choices
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-setlang]') : null;
    if (a) store.set(a.getAttribute('data-setlang'));
  });

  // this page in other languages (from the hreflang links in <head>)
  var alts = {};
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(function (l) {
    var h = l.getAttribute('hreflang');
    if (LANGS.indexOf(h) >= 0) alts[h] = l.getAttribute('href');
  });
  if (!document.body.hasAttribute('data-qr') || !alts.en) return;

  var keepQuery = function (href) { return href.replace(/^https?:\/\/[^/]+/, '') + location.search + location.hash; };
  var chosen = store.get();
  if (chosen && chosen !== here && alts[chosen]) {
    location.replace(keepQuery(alts[chosen]));
    return;
  }
  if (chosen) return;

  // suggest the browser's language, once, in that language
  var want = null;
  var prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
  for (var i = 0; i < prefs.length && !want; i++) {
    var p = String(prefs[i]).slice(0, 2).toLowerCase();
    if (LANGS.indexOf(p) >= 0) want = p;
  }
  if (!want || want === here || !alts[want]) return;
  var T = {
    en: ['This video page is also in English.', 'Show it in English', 'No thanks'],
    de: ['Diese Seite gibt es auch auf Deutsch.', 'Auf Deutsch ansehen', 'Nein, danke'],
    fr: ['Cette page existe aussi en français.', 'Voir en français', 'Non merci'],
    es: ['Esta página también está en español.', 'Ver en español', 'No, gracias']
  }[want];
  var bar = document.createElement('div');
  bar.className = 'lang-suggest';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', T[0]);
  bar.setAttribute('lang', want);
  var p1 = document.createElement('span');
  p1.textContent = T[0];
  var go = document.createElement('a');
  go.href = keepQuery(alts[want]);
  go.className = 'btn';
  go.setAttribute('hreflang', want);
  go.setAttribute('data-setlang', want);
  go.textContent = T[1];
  var no = document.createElement('button');
  no.type = 'button';
  no.className = 'btn2';
  no.textContent = T[2];
  no.addEventListener('click', function () { store.set(here); bar.remove(); });
  bar.appendChild(p1); bar.appendChild(go); bar.appendChild(no);
  var main = document.getElementById('main');
  main.parentNode.insertBefore(bar, main);
})();
