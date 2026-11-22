/* Pets Unplugged: the free page of the week.
   Reads /rotation.json and, from Monday 06:00 New York time, turns one PAWS page free for the week
   (top bar, home, /free/, the dog's page, cards, QR pals, gift links), with two offers under it:
   the dog's bundle and the whole book.
   The plain HTML is the paid site: before the first Monday, on any error, or with no free code for the
   week, nothing here changes a dog's price. Elements it touches carry data-rot* attributes.
   Node: require() this file for the week logic (tests: node --test _tests/rotation.test.js). */
(function () {
  'use strict';

  var WEEK = 7 * 864e5;
  var PAYHIP = 'https://payhip.com/b/';

  function hasCode(c) { return typeof c === 'string' && /^[A-Za-z0-9]{4,12}$/.test(c); }

  // The New York wall clock as a number: ms since 1970 as if that wall time were UTC.
  // Counting weeks on the wall clock keeps the switch at 06:00 through both DST changes.
  function wall(ms, tz) {
    var f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    var p = {};
    f.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  }

  function parseAnchor(s) {   // "2026-11-23T06:00" = 06:00 on the New York wall clock
    var m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(s || '');
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : NaN;
  }

  // Which week is it? null = before the anchor or anything odd (the page then stays paid).
  function pick(rot, now) {
    try {
      if (!rot || !rot.weeks || !rot.weeks.length) return null;
      var a = parseAnchor(rot.anchor);
      var w = wall(now.getTime(), rot.timezone || 'America/New_York');
      if (!(w >= a)) return null;
      var n = Math.floor((w - a) / WEEK), L = rot.weeks.length, i = n % L;
      return {
        index: i,
        cur: rot.weeks[i],
        next: rot.weeks[(i + 1) % L],
        until: new Date(a + (n + 1) * WEEK)   // the next switch, as a wall-clock date (read it in UTC)
      };
    } catch (e) { return null; }
  }

  // What to show. mode "free": this week's dog is free (it has a free code).
  // mode "fallback": no free code this week, so the dog stays paid and the standing free gift
  // (fallback_week, Pompom) stays as in the plain HTML. null: change nothing.
  function resolve(rot, now) {
    var P = pick(rot, now);
    if (!P || !P.cur) return null;
    var next = P.next && hasCode(P.next.free_code) && P.next !== P.cur ? P.next : null;
    var out = { index: P.index, until: P.until, next: next, nextUrl: next ? PAYHIP + next.free_code : null };
    if (hasCode(P.cur.free_code)) {
      out.mode = 'free'; out.dog = P.cur; out.url = PAYHIP + P.cur.free_code;
      return out;
    }
    var fb = rot.weeks[(rot.fallback_week || 1) - 1];
    if (!fb || !hasCode(fb.free_code)) return null;
    out.mode = 'fallback'; out.dog = fb; out.url = PAYHIP + fb.free_code;
    return out;
  }

  // Fetch rotation.json and hand the result to apply(). Any failure: apply is never called.
  function run(fetchFn, url, now, apply) {
    try {
      return Promise.resolve(fetchFn(url, { cache: 'no-cache' }))
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (rot) { var R = rot ? resolve(rot, now) : null; if (R) apply(R, rot); return R; })
        .catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  var api = { hasCode: hasCode, wall: wall, pick: pick, resolve: resolve, run: run, PAYHIP: PAYHIP };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  /* ---------------- the page ---------------- */
  var el = document.getElementById('rot-words');
  if (!el || !window.fetch || !window.Intl) return;
  var W;
  try { W = JSON.parse(el.textContent); } catch (e) { return; }
  var R_ = W.rot || {};

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  };
  var fill = function (tpl, map) {
    return String(tpl || '').replace(/%(\w+)%/g, function (m, k) { return k in map ? map[k] : m; });
  };
  var nn = function (n) { return (n < 10 ? '0' : '') + n; };
  var date = function (d) {
    try {
      return d.toLocaleDateString(W.lang || 'en', { timeZone: 'UTC', weekday: 'long', month: W.lang === 'en' ? 'short' : 'long', day: 'numeric' });
    } catch (e) { return ''; }
  };
  var step = function (f) { try { f(); } catch (e) { /* one hook failing leaves the rest */ } };

  function styles() {
    var s = document.createElement('style');
    s.textContent =
      '.rot-row{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}' +
      '.rot-row .chip{position:static}' +
      '.rot-offers{display:grid;gap:12px}' +
      '.rot-offer{display:flex;gap:14px;align-items:center;padding:12px 14px;text-decoration:none;color:var(--ink)}' +
      '.rot-offer:hover{color:var(--ink);filter:brightness(.98)}' +
      '.rot-offer img{width:64px;height:84px;object-fit:cover;object-position:top;border:2px solid var(--ink);border-radius:10px;flex:none;background:#fff}' +
      '.rot-bundle{background:var(--lilac2)}.rot-book{background:#FFF6DE}' +
      '.rot-o{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}' +
      '.rot-o .chip{position:static;align-self:flex-start;min-height:22px;font-size:12px;padding:0 8px;margin-bottom:2px}' +
      '.rot-o-p{color:var(--text2);font-size:15px;line-height:1.35}' +
      '.rot-o-go{font-weight:800;color:var(--purple);margin-top:4px}' +
      '@media (min-width:760px){.rot-offers.two{grid-template-columns:1fr 1fr}}' +
      'a.qr-pal.rot-pal{outline:3px solid var(--purple);outline-offset:-3px}' +
      '.rot-pal small{color:var(--purple);font-weight:800}' +
      '.rot-next{display:inline-flex;gap:10px;align-items:center;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.5);border-radius:14px;padding:6px 12px 6px 6px;color:#f1e6f7;font-size:15px}' +
      '.rot-next img,.rot-side-next img{width:36px;height:48px;object-fit:cover;object-position:top;border-radius:6px;border:2px solid var(--ink);background:#fff;flex:none}' +
      '.rot-side-next{display:flex;gap:12px;align-items:center;margin-bottom:12px}.rot-side-next img{width:54px;height:72px;border-radius:8px}' +
      '.rot-lines{margin-top:18px;display:grid;gap:6px}.rot-lines a{color:#fff;font-weight:800}' +
      '.rot-soon img{filter:grayscale(1);opacity:.55}';
    document.head.appendChild(s);
  }

  // The two offers under a free page: the dog's bundle, then the whole book (best value).
  function offers(R, two) {
    var d = R.dog, b = d.bundle;
    var name = d.dog || R_.this_pup;
    var bname = fill(W.bundle_link, { name: b.name });
    var pals = b.pals.map(function (p) { return p.title; }).join(', ');
    return '<div class="rot-offers' + (two ? ' two' : '') + '" data-rot-made="offers">' +
      '<a class="page rot-offer rot-bundle" href="' + esc(PAYHIP + b.code) + '">' +
        '<img src="/assets/img/bundles/' + esc(b.slug) + '.jpg" alt="' + esc(bname + ': ' + d.title + ', ' + pals) + '" width="64" height="84">' +
        '<span class="rot-o"><span class="b">' + esc(fill(R_.bundle_h, { name: name })) + '</span>' +
        '<span class="rot-o-p">' + esc(fill(R_.bundle_p, { title: d.title, bundle: bname })) + '</span>' +
        '<span class="rot-o-go">' + esc(W.get_bundle + (W.lang === 'fr' ? ' : ' : ': ') + W.bundle_price) + ' &rarr;</span></span></a>' +
      '<a class="page rot-offer rot-book" href="' + esc(PAYHIP + d.book_code) + '">' +
        '<img src="/assets/images/paws_cover.webp" alt="" width="64" height="84">' +
        '<span class="rot-o"><span class="chip chip-gold">' + esc(R_.best) + '</span><span class="b">' + esc(W.whole_book) + '</span>' +
        '<span class="rot-o-p">' + esc(fill(R_.book_p, { pdf: W.pdf })) + '</span>' +
        '<span class="rot-o-go">' + esc(fill(R_.book_go, { pdf: W.pdf })) + ' &rarr;</span></span></a>' +
      '</div>';
  }

  function apply(R) {
    var d = R.dog, free = R.mode === 'free', until = date(R.until);
    var line = '/assets/img/pages/paws-' + nn(d.page) + '-line.jpg';
    var color = '/assets/img/pages/paws-' + nn(d.page) + '-color.jpg';
    var getTitle = fill(R_.get_title, { title: d.title });
    styles();

    // Top bar (every page)
    if (free) step(function () {
      var tb = $('[data-rot="topbar"]');
      if (tb) tb.innerHTML = esc(fill(R_.topbar, { title: d.title })) + ' <a href="' + esc(R.url) + '">' + esc(W.get_it_free) + '</a>';
    });

    // The dog's own page
    step(function () {
      var sec = $('[data-rot-dog]');
      if (!sec || +sec.getAttribute('data-rot-dog') !== d.page) return;
      var buy = $('[data-rot="buy"]', sec);
      if (!free) {   // fallback week: the standing free gift line, as before the rotation
        var gift = '<p class="small" style="margin: 0" data-rot-made="gift"><b>' + esc(W.free_gift_b) + '</b> <a href="' + esc(R.url) + '">' + esc(W.get_it_free) + '</a> ' + esc(W.with_email) + '</p>';
        var at = $('[data-rot="bundle-line"]', sec);
        if (at) at.insertAdjacentHTML('beforebegin', gift); else if (buy) buy.parentNode.insertAdjacentHTML('afterend', gift);
        return;
      }
      if (buy) {
        var a = document.createElement('a');
        a.className = 'btn'; a.href = R.url; a.textContent = R_.get_page;
        buy.parentNode.replaceChild(a, buy);
        a.parentNode.insertAdjacentHTML('beforebegin', '<div class="rot-row" data-rot-made="chip"><span class="chip chip-gold">' + esc(R_.chip) + '</span><span class="small muted">' +
          esc(fill(R_.until, { date: until }) + ' · ' + fill(R_.then, { single: W.single })) + '</span></div>');
      }
      var bl = $('[data-rot="bundle-line"]', sec);
      if (bl) { bl.insertAdjacentHTML('afterend', offers(R)); bl.hidden = true; }
      var bk = $('[data-rot="book-line"]', sec);
      if (bk) bk.hidden = true;
    });

    if (free) {
      // QR pages: the free pal
      step(function () {
        $$('a[data-rot-pal="' + d.page + '"]').forEach(function (a) {
          a.href = R.url; a.classList.add('rot-pal');
          var s = $('small', a); if (s) s.textContent = R_.chip;
        });
      });
      // Cards: "· $1.99" becomes "· Free this week"
      step(function () {
        $$('[data-rot-card="' + d.page + '"] .card-sub').forEach(function (s) {
          s.innerHTML = s.innerHTML.split(esc(W.single)).join(esc(R_.chip));
        });
      });
    }

    // Home: the purple free block
    step(function () {
      var h = $('[data-rot="home-free"]');
      if (!h) return;
      if (free) {
        $('[data-rot="h"]', h).textContent = fill(R_.home_h, { title: d.title });
        $('[data-rot="p"]', h).textContent = fill(R_.home_p, { n: d.page, date: until });
        var btn = $('[data-rot="btn"]', h); btn.href = R.url; btn.textContent = getTitle;
        var il = $('[data-rot="img-line"]', h), ic = $('[data-rot="img-color"]', h);
        if (il) { il.src = line; il.alt = fill(R_.free_alt, { title: d.title }); }
        if (ic) { ic.src = color; ic.alt = ''; }
      }
      var row = $('[data-rot="btn"]', h).parentNode, html = '';
      if (R.next) html += '<div style="margin-top: 18px"><span class="rot-next"><img src="/assets/img/pages/paws-' + nn(R.next.page) + '-color.jpg" alt="" width="36" height="48"><span><b style="color:#fff">' +
        esc(R_.next) + ':</b> ' + esc(R.next.title) + '</span></span></div>';
      html += '<div class="rot-lines"><a href="' + esc(PAYHIP + d.bundle.code) + '">' + esc(fill(R_.home_bundle, { name: d.dog || R_.this_pup, bundle: fill(W.bundle_link, { name: d.bundle.name }), price: W.bundle_price })) + ' &rarr;</a>' +
        '<a href="' + esc(PAYHIP + d.book_code) + '">' + esc(fill(R_.book_line, { pdf: W.pdf })) + ' &rarr;</a></div>';
      row.insertAdjacentHTML('afterend', html);
    });

    // Home: the newsletter gift
    if (free) step(function () {
      var g = $('[data-rot="nl-gift"]');
      if (!g) return;
      var im = $('img', g); if (im) { im.src = line; im.alt = fill(R_.free_alt, { title: d.title }); }
      $('[data-rot="h"]', g).textContent = fill(R_.side_h, { title: d.title });
      var a = $('a', g); a.href = R.url; a.textContent = getTitle;
    });

    // /free/
    step(function () {
      var c1 = $('[data-rot="free-card"]');
      if (!c1) return;
      if (free) {
        $('[data-rot="lead"]').textContent = fill(R_.free_lead, { title: d.title });
        c1.href = R.url;
        var im = $('img', c1); im.src = line; im.alt = fill(R_.free_alt, { title: d.title });
        $('.chip', c1).textContent = R_.chip;
        $('.card-title', c1).textContent = d.title;
        $('.card-sub', c1).innerHTML = esc(fill(R_.until, { date: until })) + '<br>' + esc(W.free_card_sub);
      }
      var c2 = $('[data-rot="free-next"]');
      if (R.next && c2) {
        c2.outerHTML = '<div class="page card rot-soon" data-rot-made="next"><div class="card-img"><img src="/assets/img/pages/paws-' + nn(R.next.page) + '-line.jpg" alt="' + esc(fill(R_.free_alt, { title: R.next.title })) + '" width="450" height="600">' +
          '<span class="chip chip-sky">' + esc(R_.next) + '</span></div><div class="card-body"><div class="card-title">' + esc(R.next.title) + '</div><div class="card-sub">' +
          esc(fill(R_.from, { date: date(R.until) })) + '</div></div></div>';
      }
      var grid = c1.parentNode;
      grid.insertAdjacentHTML('afterend', '<div style="margin-top: 22px">' + offers(R, true) + '</div>');

      var side = $('[data-rot="free-side"]');
      if (!side) return;
      if (free) {
        $('[data-rot="h"]', side).textContent = fill(R_.side_h, { title: d.title });
        $('[data-rot="p"]', side).insertAdjacentHTML('beforebegin', '<p class="b" style="margin: 8px 0 0">' + esc(fill(R_.side_time, { date: until })) + '</p>');
        var b = $('[data-rot="btn"]', side); b.href = R.url; b.textContent = getTitle;
        $('[data-rot="more"]', side).textContent = R_.new_every;
      }
      if (R.next) $('hr', side).insertAdjacentHTML('afterend', '<div class="rot-side-next"><img src="/assets/img/pages/paws-' + nn(R.next.page) + '-color.jpg" alt="" width="54" height="72"><div><div class="small muted b">' +
        esc(R_.next) + '</div><div class="b">' + esc(R.next.title) + '</div></div></div>');
    });

    if (!free) return;   // the rest only changes in a real free week

    // Books: "Not sure yet? Start free."
    step(function () {
      var g = $('[data-rot="books-gift"]');
      if (!g) return;
      $('[data-rot="p"]', g).textContent = fill(R_.topbar, { title: d.title });
      var a = $('[data-rot="btn"]', g); a.href = R.url; a.textContent = getTitle;
    });

    // Holiday: the free card
    step(function () {
      var c = $('[data-rot="holiday-gift"]');
      if (!c) return;
      c.href = R.url;
      var im = $('img', c); im.src = line; im.alt = fill(R_.free_alt, { title: d.title });
      $('.chip', c).textContent = R_.chip;
      $('.card-title', c).textContent = fill(R_.side_h, { title: d.title });
      $('.card-sub', c).textContent = fill(R_.until, { date: until });
    });

    // Scout's story page: Pompom is free only in its own week
    step(function () {
      var s = $('[data-rot="story"]');
      if (!s || d.page === 1) return;
      var paid = s.getAttribute('data-rot-paid');
      var b = $('[data-rot="btn"]', s);
      if (b && paid) { b.href = paid; b.textContent = fill(R_.story_paid, { single: W.single }); }
      var p = $('[data-rot="p"]', s);
      if (p) p.innerHTML = esc(fill(R_.topbar, { title: d.title })) + ' <a href="' + esc(R.url) + '">' + esc(W.get_it_free) + '</a>';
      $$('[data-rot="story-free"]').forEach(function (x) { x.hidden = true; });
    });
  }

  var go = function () { run(window.fetch.bind(window), '/rotation.json', new Date(), apply); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
