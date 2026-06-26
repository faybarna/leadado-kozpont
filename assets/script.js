/* =========================================================================
   LEADADÓ KÖZPONT — script.js
   1) Jelszókapu (SHA-256 hash összevetés, localStorage "emlékezés")
   2) Folder-tab navigáció aktív állapot (scroll alapján)
   3) Dokumentum-igénylista tabok
   4) Újdonságok (changelog.json) renderelés + "Frissítve" stamp
   5) F5 — Saját Ügyleteim (?p= token alapú partner pipeline)
   ========================================================================= */

(function(){

  /* ---------------- 1) JELSZÓKAPU ---------------- */

  // SHA-256("lead123!")
  var PASS_HASH = "c2d12704fd8733f239d86f36be1e2ba3c98d962a0f993ba973155af72432b7ff";
  var STORAGE_KEY = "lk_auth_v1";

  var gate   = document.getElementById("gate");
  var form   = document.getElementById("gate-form");
  var input  = document.getElementById("gate-input");
  var error  = document.getElementById("gate-error");

  function sha256Hex(text){
    var enc = new TextEncoder().encode(text);
    return crypto.subtle.digest("SHA-256", enc).then(function(buf){
      var bytes = new Uint8Array(buf);
      var hex = "";
      for (var i = 0; i < bytes.length; i++){
        hex += bytes[i].toString(16).padStart(2, "0");
      }
      return hex;
    });
  }

  function unlock(){
    document.body.classList.remove("locked");
    gate.classList.add("hidden");
  }

  // Korábbi belépés esetén azonnal megnyitjuk
  try {
    if (localStorage.getItem(STORAGE_KEY) === "ok") {
      unlock();
    }
  } catch(e) { /* localStorage nem elérhető — jelszó mindig kérve lesz */ }

  if (form) {
    form.addEventListener("submit", function(e){
      e.preventDefault();
      var val = input.value || "";
      sha256Hex(val).then(function(hash){
        if (hash === PASS_HASH){
          try { localStorage.setItem(STORAGE_KEY, "ok"); } catch(e){}
          error.textContent = "";
          unlock();
        } else {
          error.textContent = "Hibás jelszó.";
          input.value = "";
          input.focus();
        }
      });
    });
  }

  /* ---------------- 1b) MAILTO — PWA FIX ---------------- */
  // iOS PWA standalone módban a mailto linkek webview-navigációt váltanak ki.
  // Megoldás: dinamikusan létrehozott link .click() — minden módban megbízható.
  var isStandalone = (window.navigator.standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches;
  if (isStandalone) {
    document.querySelectorAll('a[href^="mailto:"]').forEach(function(el) {
      el.addEventListener("click", function(e) {
        e.preventDefault();
        var tmp = document.createElement("a");
        tmp.href = el.getAttribute("href");
        tmp.style.display = "none";
        document.body.appendChild(tmp);
        tmp.click();
        document.body.removeChild(tmp);
      });
    });
  }

  /* ---------------- 2) NAV AKTÍV ÁLLAPOT ---------------- */

  var navItems = Array.prototype.slice.call(document.querySelectorAll(".nav-item"));
  var sections = navItems.map(function(item){
    return document.querySelector(item.getAttribute("href"));
  });

  if ("IntersectionObserver" in window){
    var observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting){
          var idx = sections.indexOf(entry.target);
          if (idx === -1) return;
          navItems.forEach(function(n){ n.classList.remove("active"); });
          navItems[idx].classList.add("active");
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });

    sections.forEach(function(s){ if (s) observer.observe(s); });
  }

  /* ---------------- 3) DOKUMENTUM-IGÉNYLISTA TABOK ---------------- */

  var tabs   = Array.prototype.slice.call(document.querySelectorAll(".doclist-tab"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".doclist-panel"));

  tabs.forEach(function(tab){
    tab.addEventListener("click", function(){
      tabs.forEach(function(t){ t.classList.remove("active"); });
      panels.forEach(function(p){ p.classList.remove("active"); });

      tab.classList.add("active");
      var target = document.getElementById(tab.getAttribute("data-target"));
      if (target) target.classList.add("active");
    });
  });

  /* ---------------- 4) ÚJDONSÁGOK / CHANGELOG ---------------- */

  var listEl  = document.getElementById("changelog-list");
  var stampEl = document.getElementById("stamp");

  function formatDate(iso){
    var parts = iso.split("-");
    if (parts.length !== 3) return iso;
    return parts[0] + ". " + parts[1] + ". " + parts[2] + ".";
  }

  function isRecent(iso){
    var entryDate = new Date(iso);
    var now = new Date();
    var diffDays = (now - entryDate) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 14;
  }

  fetch("changelog.json")
    .then(function(res){
      if (!res.ok) throw new Error("changelog fetch failed");
      return res.json();
    })
    .then(function(items){
      if (!Array.isArray(items) || items.length === 0){
        listEl.innerHTML = '<p class="changelog-empty">Még nincs bejegyzés.</p>';
        return;
      }

      items.sort(function(a, b){ return b.datum.localeCompare(a.datum); });

      if (stampEl){
        stampEl.textContent = "Frissítve: " + formatDate(items[0].datum);
      }

      listEl.innerHTML = items.map(function(item){
        var badge = isRecent(item.datum) ? '<span class="badge-new">Új</span>' : "";
        return (
          '<div class="changelog-item">' +
            '<div class="changelog-date">' + formatDate(item.datum) + '</div>' +
            '<div>' +
              '<div class="changelog-title">' + item.cim + badge + '</div>' +
              '<div class="changelog-desc">' + item.leiras + '</div>' +
            '</div>' +
          '</div>'
        );
      }).join("");
    })
    .catch(function(){
      listEl.innerHTML = '<p class="changelog-empty">A napló jelenleg nem tölthető be.</p>';
      if (stampEl) stampEl.textContent = "Frissítve: —";
    });

  /* ---------------- 5) SAJÁT ÜGYLETEIM — F5 ---------------- */

  var sajatSection = document.getElementById("sajat-ugyletek");
  var sajatNav     = document.getElementById("nav-saját");
  var sajatTar     = document.getElementById("sajat-tartalom");
  var sajatLead    = document.getElementById("sajat-lead");

  var urlParams = new URLSearchParams(window.location.search);
  var partnerToken = urlParams.get("p");

  // Telepített app (PWA) a start_url-ből indul, ?p= token NÉLKÜL. Hogy az ikonról
  // indított app is tudja, ki a partner: ha most jött token az URL-ben, elmentjük;
  // ha nincs token, visszatöltjük a korábban mentettet.
  var PARTNER_TOKEN_KEY = "lk_partner_token";
  try {
    if (partnerToken) {
      localStorage.setItem(PARTNER_TOKEN_KEY, partnerToken);
    } else {
      var savedToken = localStorage.getItem(PARTNER_TOKEN_KEY);
      if (savedToken) partnerToken = savedToken;
    }
  } catch (e) { /* localStorage nem elérhető — marad az URL-token (ha volt) */ }

  var LEZART_STATUSZOK = ["5. Folyósítva", "3. Megkötve"];

  function statuszBadge(statusz) {
    var isLezart = LEZART_STATUSZOK.indexOf(statusz) !== -1;
    var cls = isLezart ? "statusz-badge statusz-badge--lezart" : "statusz-badge";
    return '<span class="' + cls + '">' + statusz + '</span>';
  }

  // BSZ ping jelzés — a Master Board "Következő feladat" cellából (PING 1 / PING 2).
  // Piros badge: a leadadó látja, melyik bankszámla-ügyletet kell sürgetni.
  function pingBadge(u) {
    if (!u || !u.ping) return "";
    return ' <span class="ping-badge">🔴 ' + u.ping + '</span>';
  }

  function renderPipelineTable(data) {
    if (!data.ugyletek || data.ugyletek.length === 0) {
      return '<div class="sajat-empty">Jelenleg nincs aktív ügyleted.</div>';
    }

    var rows = data.ugyletek.map(function(u) {
      var ehStr  = u.eh ? u.eh + " EH" : "—";
      var honap  = u.elszamolasi_honap || "—";
      return (
        "<tr" + (u.ping ? ' class="pipeline-row--ping"' : "") + ">" +
          "<td>" + u.ugyfel + "</td>" +
          "<td>" + u.termek + "</td>" +
          "<td>" + u.bank + "</td>" +
          "<td>" + statuszBadge(u.statusz) + pingBadge(u) + "</td>" +
          '<td class="eh-cell">' + ehStr + "</td>" +
          "<td>" + honap + "</td>" +
        "</tr>"
      );
    }).join("");

    return (
      '<p class="pipeline-meta">Frissítve: ' + (data.frissitve || "—") + " · " + data.ugyletek.length + " aktív ügylet</p>" +
      '<div style="overflow-x:auto"><table class="pipeline-table">' +
        "<thead><tr>" +
          "<th>Ügyfél</th><th>Termék</th><th>Bank</th><th>Státusz</th><th>EH</th><th>Elszámolási hónap</th>" +
        "</tr></thead>" +
        "<tbody>" + rows + "</tbody>" +
      "</table></div>" +
      renderMonthlyBreakdown(data.ugyletek)
    );
  }

  function renderMonthlyBreakdown(ugyletek) {
    var grouped = {};
    var order   = [];

    ugyletek.forEach(function(u) {
      var honap = u.elszamolasi_honap || "";
      if (!honap) return;
      if (!grouped[honap]) {
        grouped[honap] = { db: 0, eh: 0 };
        order.push(honap);
      }
      grouped[honap].db++;
      grouped[honap].eh += (u.eh || 0);
    });

    if (order.length === 0) return "";

    // Sort by the year+month string (lexicographic works for "2026. Június" etc. only within one year;
    // use a month-name map for correct Hungarian ordering)
    var HONAP_SORREND = ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"];
    order.sort(function(a, b) {
      var aY = parseInt(a) || 0;
      var bY = parseInt(b) || 0;
      if (aY !== bY) return aY - bY;
      var aM = HONAP_SORREND.findIndex(function(m){ return a.indexOf(m) !== -1; });
      var bM = HONAP_SORREND.findIndex(function(m){ return b.indexOf(m) !== -1; });
      return aM - bM;
    });

    var totalEh = order.reduce(function(s, h){ return s + grouped[h].eh; }, 0);

    var rows = order.map(function(honap) {
      var g = grouped[honap];
      return (
        "<tr>" +
          "<td>" + honap + "</td>" +
          "<td>" + g.db + " ügylet</td>" +
          '<td class="eh-cell">' + g.eh + " EH</td>" +
        "</tr>"
      );
    }).join("");

    return (
      '<div class="monthly-breakdown">' +
        '<h4 class="monthly-title">Havi összesítő</h4>' +
        '<div style="overflow-x:auto"><table class="pipeline-table monthly-table">' +
          "<thead><tr><th>Elszámolási hónap</th><th>Ügyletek</th><th>EH összeg</th></tr></thead>" +
          "<tbody>" + rows + "</tbody>" +
          '<tfoot><tr class="monthly-total"><td>Összesen</td><td></td><td class="eh-cell">' + totalEh + " EH</td></tr></tfoot>" +
        "</table></div>" +
      "</div>"
    );
  }

  function renderCsapatView(csapat) {
    var sections = csapat.map(function(tag) {
      if (!tag.ugyletek || tag.ugyletek.length === 0) {
        return (
          '<div class="csapat-tag-block">' +
            '<h4 class="csapat-tag-name">' + tag.partner + '</h4>' +
            '<p class="sajat-empty" style="padding:12px 0">Jelenleg nincs aktív ügylet.</p>' +
          '</div>'
        );
      }
      var rows = tag.ugyletek.map(function(u) {
        var ehStr = u.eh ? u.eh + " EH" : "—";
        return (
          "<tr" + (u.ping ? ' class="pipeline-row--ping"' : "") + ">" +
            "<td>" + u.ugyfel + "</td>" +
            "<td>" + u.termek + "</td>" +
            "<td>" + u.bank + "</td>" +
            "<td>" + statuszBadge(u.statusz) + pingBadge(u) + "</td>" +
            '<td class="eh-cell">' + ehStr + "</td>" +
            "<td>" + (u.elszamolasi_honap || "—") + "</td>" +
          "</tr>"
        );
      }).join("");
      return (
        '<div class="csapat-tag-block">' +
          '<h4 class="csapat-tag-name">' + tag.partner + '</h4>' +
          '<div style="overflow-x:auto"><table class="pipeline-table">' +
            "<thead><tr><th>Ügyfél</th><th>Termék</th><th>Bank</th><th>Státusz</th><th>EH</th><th>Elszámolási hónap</th></tr></thead>" +
            "<tbody>" + rows + "</tbody>" +
          "</table></div>" +
          renderMonthlyBreakdown(tag.ugyletek) +
        "</div>"
      );
    }).join("");

    return (
      '<div class="csapat-view">' +
        '<h3 class="csapat-view-title">Csapatom</h3>' +
        sections +
      '</div>'
    );
  }

  function renderVezetiView(vezeti) {
    var HONAP_SORREND = ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"];

    // Collect all unique months across all teams, sort them
    var honapSet = {};
    vezeti.forEach(function(v) {
      if (v.honap_bontas) {
        Object.keys(v.honap_bontas).forEach(function(h) { honapSet[h] = true; });
      }
    });
    var honapok = Object.keys(honapSet).sort(function(a, b) {
      var aY = parseInt(a) || 0, bY = parseInt(b) || 0;
      if (aY !== bY) return aY - bY;
      var aM = HONAP_SORREND.findIndex(function(m){ return a.indexOf(m) !== -1; });
      var bM = HONAP_SORREND.findIndex(function(m){ return b.indexOf(m) !== -1; });
      return aM - bM;
    });

    // Short month label: "2026. Július" → "Júl."
    function shortHonap(h) {
      for (var i = 0; i < HONAP_SORREND.length; i++) {
        if (h.indexOf(HONAP_SORREND[i]) !== -1) return HONAP_SORREND[i].slice(0, 3) + ".";
      }
      return h;
    }

    var totalEh = vezeti.reduce(function(s, v) { return s + (v.eh_sum || 0); }, 0);
    var honapTotals = {};
    honapok.forEach(function(h) {
      honapTotals[h] = vezeti.reduce(function(s, v) { return s + ((v.honap_bontas && v.honap_bontas[h]) || 0); }, 0);
    });

    var headerCells = "<th>Csapatvezető</th><th>Ügyletek</th>" +
      honapok.map(function(h) { return "<th>" + shortHonap(h) + " EH</th>"; }).join("") +
      "<th>Össz. EH</th>";

    var rows = vezeti.map(function(v) {
      var honapCells = honapok.map(function(h) {
        var eh = (v.honap_bontas && v.honap_bontas[h]) || 0;
        return '<td class="eh-cell">' + (eh || "—") + (eh ? " EH" : "") + "</td>";
      }).join("");
      return (
        "<tr>" +
          "<td>" + v.vezeto + "</td>" +
          "<td>" + (v.ugyletek_db || 0) + " ügylet</td>" +
          honapCells +
          '<td class="eh-cell">' + (v.eh_sum || 0) + " EH</td>" +
        "</tr>"
      );
    }).join("");

    var footerHonapCells = honapok.map(function(h) {
      return '<td class="eh-cell">' + (honapTotals[h] || 0) + " EH</td>";
    }).join("");

    return (
      '<div class="vezeti-view">' +
        '<h3 class="csapat-view-title">Vezeted csapatok összesítője</h3>' +
        '<div class="card">' +
          '<div style="overflow-x:auto"><table class="pipeline-table monthly-table">' +
            "<thead><tr>" + headerCells + "</tr></thead>" +
            "<tbody>" + rows + "</tbody>" +
            '<tfoot><tr class="monthly-total"><td>Összesen</td><td></td>' + footerHonapCells + '<td class="eh-cell">' + totalEh + " EH</td></tr></tfoot>" +
          "</table></div>" +
        "</div>" +
      "</div>"
    );
  }

  function loadPartnerData(token) {
    fetch("data/partners/" + token + ".json")
      .then(function(res) {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then(function(data) {
        if (sajatLead) sajatLead.textContent = data.partner + " — aktív ügyletek";
        var html = '<div class="card">' + renderPipelineTable(data) + "</div>";
        if (data.csapat && data.csapat.length > 0) {
          html += renderCsapatView(data.csapat);
        }
        if (data.vezeti && data.vezeti.length > 0) {
          html += renderVezetiView(data.vezeti);
        }
        sajatTar.innerHTML = html;
        updateAppBadge(data);
      })
      .catch(function() {
        sajatTar.innerHTML = '<div class="card"><div class="sajat-empty">Az adatok jelenleg nem elérhetők. Kérjük, próbáld újra később.</div></div>';
      });
  }

  // App-ikon badge (Badging API): a saját sürgetendő (PING) tételek száma.
  // Csak telepített PWA-ban látszik; böngészőben no-op. Feature-detect kötelező.
  function updateAppBadge(data) {
    if (!("setAppBadge" in navigator)) return;
    try {
      var ping = (data && data.ugyletek ? data.ugyletek : []).filter(function(u) {
        return u && u.ping;
      }).length;
      if (ping > 0) navigator.setAppBadge(ping);
      else navigator.clearAppBadge();
    } catch (e) { /* a badge csak kényelmi extra — hiba ne törje meg az oldalt */ }
  }

  // Telepített (standalone) app a start_url-ből indul, ?p= token nélkül. Az iPhone
  // a telepített appnak külön tárolót ad, ezért a Safariban mentett token nem mindig
  // elérhető itt. Megoldás: ilyenkor egyszeri "add meg a linked" mezőt mutatunk,
  // amit az app utána megjegyez.
  function isStandaloneApp() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  }

  function revealSajat() {
    if (sajatSection) sajatSection.style.display = "";
    if (sajatNav)     sajatNav.style.display     = "";
    var mmpSajatEl = document.getElementById("mmp-sajat");
    if (mmpSajatEl)   mmpSajatEl.style.display    = "";
    // Lenti sáv átrendezése partnernek: Saját csempe be, CHK át a „Több" panelbe,
    // hogy a leadadó legfontosabb nézete egy koppintásra legyen (ne a Több alatt).
    var mbnSajat = document.getElementById("mbn-sajat");
    var mbnChk   = document.getElementById("mbn-chk");
    var mmpChk   = document.getElementById("mmp-chk");
    if (mbnSajat) mbnSajat.style.display = "";
    if (mbnChk)   mbnChk.style.display   = "none";
    if (mmpChk)   mmpChk.style.display   = "";
  }

  function activatePartner(token) {
    try { localStorage.setItem(PARTNER_TOKEN_KEY, token); } catch (e) {}
    partnerToken = token;
    revealSajat();
    loadPartnerData(token);
  }

  // Token kinyerése a beillesztett szövegből: lehet teljes link (?p=…) vagy maga a token.
  function extractToken(raw) {
    var s = (raw || "").trim();
    if (!s) return "";
    var m = s.match(/[?&]p=([^&\s]+)/);
    if (m) return decodeURIComponent(m[1]);
    if (s.indexOf("/") !== -1) return s.replace(/^.*\//, "").replace(/[?#].*$/, "");
    return s;
  }

  function renderTokenEntry(msg) {
    if (!sajatTar) return;
    sajatTar.innerHTML =
      '<div class="card">' +
        '<div class="sajat-locked" style="margin-bottom:12px">' +
          (msg || 'Első indítás: illeszd be a személyes linkedet (amit Barnától kaptál), és az app megjegyzi — legközelebb már magától betölt.') +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<input id="token-entry-input" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" ' +
            'placeholder="https://…?p=…  vagy a tokened" ' +
            'style="flex:1;min-width:200px;padding:10px 12px;border:1px solid #c9bfa6;border-radius:8px;font-size:15px;background:#fff">' +
          '<button id="token-entry-btn" class="btn-brass" style="padding:10px 18px">Betöltés</button>' +
        '</div>' +
      '</div>';
    var input = document.getElementById("token-entry-input");
    var btn   = document.getElementById("token-entry-btn");
    function submit() {
      var tok = extractToken(input ? input.value : "");
      if (!tok) { if (input) input.focus(); return; }
      if (btn) { btn.disabled = true; btn.textContent = "Töltés…"; }
      fetch("data/partners/" + tok + ".json")
        .then(function(res){ if(!res.ok) throw new Error("404"); return res.json(); })
        .then(function(){ activatePartner(tok); })
        .catch(function(){ renderTokenEntry('Ezt a linket/tokent nem találtam. Ellenőrizd, és próbáld újra.'); });
    }
    if (btn)   btn.addEventListener("click", submit);
    if (input) input.addEventListener("keydown", function(e){ if (e.key === "Enter") submit(); });
  }

  if (partnerToken) {
    activatePartner(partnerToken);
  } else if (isStandaloneApp()) {
    // Telepített app token nélkül → mutassuk a Saját fület és a beviteli mezőt.
    revealSajat();
    renderTokenEntry();
  } else {
    // Sima böngésző, token nélkül — személyre szabott nézet, a link kell hozzá.
    if (sajatTar) {
      sajatTar.innerHTML = '<div class="card"><div class="sajat-locked">Ez a nézet személyre szabott — kérd el a saját linkedet Barnától.</div></div>';
    }
  }

  /* ---------------- 6) MOBIL BOTTOM NAV ---------------- */

  var mbnItems      = Array.prototype.slice.call(document.querySelectorAll(".mbn-item[data-mbn]"));
  var mbnMoreBtn    = document.getElementById("mbn-more-btn");
  var moreOverlay   = document.getElementById("mobile-more-overlay");
  var morePanel     = document.getElementById("mobile-more-panel");
  var mmpClose      = document.getElementById("mmp-close");
  var mmpItems      = Array.prototype.slice.call(document.querySelectorAll(".mmp-item"));

  function openMorePanel() {
    if (!moreOverlay) return;
    moreOverlay.classList.add("open");
    if (mbnMoreBtn) mbnMoreBtn.setAttribute("aria-expanded", "true");
  }

  function closeMorePanel() {
    if (!moreOverlay) return;
    moreOverlay.classList.remove("open");
    if (mbnMoreBtn) mbnMoreBtn.setAttribute("aria-expanded", "false");
  }

  if (mbnMoreBtn) mbnMoreBtn.addEventListener("click", openMorePanel);
  if (mmpClose)   mmpClose.addEventListener("click", closeMorePanel);

  if (moreOverlay) {
    moreOverlay.addEventListener("click", function(e) {
      if (e.target === moreOverlay) closeMorePanel();
    });
  }

  // Panel linkekre kattintva zárul + aktív állapot frissítése
  mmpItems.forEach(function(item) {
    item.addEventListener("click", function() {
      closeMorePanel();
      var sectionId = item.getAttribute("data-mbn");
      setMbnActive(sectionId);
    });
  });

  // Bottom nav aktív állapot beállítása
  function setMbnActive(sectionId) {
    mbnItems.forEach(function(n) { n.classList.remove("active"); });
    var match = document.querySelector(".mbn-item[data-mbn='" + sectionId + "']");
    if (match) match.classList.add("active");
  }

  // IntersectionObserver szinkronizálása a bottom nav-val
  if ("IntersectionObserver" in window) {
    var mbnSectionIds = ["attekintes","ai-asszisztens","hiteladatlapok","igenylistak",
                         "kepzes","ujdonsagok","versenyek","faq","sajat-ugyletek"];
    var mbnObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          setMbnActive(entry.target.id);
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });

    mbnSectionIds.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) mbnObserver.observe(el);
    });
  }

  // Ha partner token van, a SAJÁT item a panelben is megjelenik
  if (partnerToken) {
    var mmpSajat = document.getElementById("mmp-sajat");
    if (mmpSajat) mmpSajat.style.display = "";
  }

  /* ---------------- 7) KERESŐSÁV ---------------- */

  var SEARCH_INDEX = [
    { tag: "AI",  title: "AI Asszisztens",               href: "#ai-asszisztens",  keywords: "ai asszisztens kérdés bankszámla dokumentum mesterséges intelligencia" },
    { tag: "DOK", title: "Hiteladatlapok & Segédletek",  href: "#hiteladatlapok",  keywords: "hiteladatlap segédlet jelzálog személyi kölcsön babaváró munkáshitel drive mappa" },
    { tag: "CHK", title: "Dokumentum-igénylisták",       href: "#igenylistak",     keywords: "dokumentum igénylista checklist ügyfél irat bekérés" },
    { tag: "EDU", title: "Képzési anyagok",              href: "#kepzes",          keywords: "képzés oktatás tananyag hitel bankszámla folyamat" },
    { tag: "ÚJ",  title: "Újdonságok",                  href: "#ujdonsagok",      keywords: "újdonság változás frissítés napló changelog" },
    { tag: "🏆",  title: "Versenyek",                   href: "#versenyek",       keywords: "verseny eredmény feltétel" },
    { tag: "?",   title: "Gyakori kérdések (GYIK)",      href: "#faq",             keywords: "faq gyik kérdés válasz" },
    { tag: "FŐ",  title: "Áttekintés",                  href: "#attekintes",      keywords: "áttekintés főoldal kezdőlap összefoglaló" }
  ];

  var searchInput   = document.getElementById("search-input");
  var searchClear   = document.getElementById("search-clear");
  var searchResults = document.getElementById("search-results");

  function renderSearch(query) {
    var q = (query || "").toLowerCase().trim();

    if (!q) {
      searchResults.classList.remove("visible");
      searchResults.innerHTML = "";
      searchClear.classList.remove("visible");
      return;
    }

    searchClear.classList.add("visible");

    var hits = SEARCH_INDEX.filter(function(item) {
      return (item.title + " " + item.keywords).toLowerCase().indexOf(q) !== -1;
    });

    if (hits.length === 0) {
      searchResults.innerHTML = '<div class="search-no-result">Nincs találat a „' + query + '" kifejezésre.</div>';
    } else {
      searchResults.innerHTML = hits.map(function(item) {
        return (
          '<a class="search-result-item" href="' + item.href + '">' +
            '<span class="search-result-tag">' + item.tag + '</span>' +
            '<span class="search-result-title">' + item.title + '</span>' +
            '<span style="margin-left:auto; color:var(--brass); font-size:16px;">→</span>' +
          '</a>'
        );
      }).join("");
    }
    searchResults.classList.add("visible");
  }

  if (searchInput) {
    searchInput.addEventListener("input", function() {
      renderSearch(searchInput.value);
    });
  }

  if (searchClear) {
    searchClear.addEventListener("click", function() {
      searchInput.value = "";
      renderSearch("");
      searchInput.focus();
    });
  }

  /* ---------------- 8) MOBIL „LAPOZÓS" NÉZET ----------------
     Mobilon nem egy hosszú görgetős oldal: egyszerre EGY szekció látszik,
     koppintásra váltunk (mint egy natív app). Így megszűnik a görgetés a
     szekciók KÖZÖTT. Desktopon (≥861px) marad a megszokott görgetős oldal. */

  var mqMobile     = window.matchMedia("(max-width: 860px)");
  var allSections  = Array.prototype.slice.call(document.querySelectorAll(".main > .section"));
  var DEFAULT_SECTION = "attekintes";

  function showSection(id) {
    var target = document.getElementById(id);
    if (!target || !target.classList.contains("section")) return;
    if (target.style.display === "none") return;   // rejtett (pl. Saját token nélkül) — ne ugorjunk rá
    allSections.forEach(function(s){ s.classList.remove("section--active"); });
    target.classList.add("section--active");
    setMbnActive(id);
    navItems.forEach(function(n){ n.classList.remove("active"); });
    var navMatch = document.querySelector('.nav-item[href="#' + id + '"]');
    if (navMatch) navMatch.classList.add("active");
    window.scrollTo(0, 0);              // minden új „lap" a tetejéről indul
    var mainEl = document.querySelector(".main");
    if (mainEl) mainEl.scrollTop = 0;
  }

  function defaultSection() {
    // Push / mély link, vagy telepített app: a Saját nézet a cél (oda visz a push is).
    var nyit = new URLSearchParams(window.location.search).get("nyit");
    var sajatLathato = sajatSection && sajatSection.style.display !== "none";
    if (nyit === "sajat" && sajatLathato) return "sajat-ugyletek";
    if (isStandaloneApp() && sajatLathato) return "sajat-ugyletek";
    return DEFAULT_SECTION;
  }

  function enableTabbed() {
    document.body.classList.add("tabbed");
    if (!document.querySelector(".main > .section.section--active")) {
      showSection(defaultSection());
    }
  }
  function disableTabbed() {
    document.body.classList.remove("tabbed");   // desktop: a görgetős oldal visszatér
  }

  // Lapon belüli horgony-link (#…) tabbed módban lapváltást jelent — nincs görgetés.
  document.addEventListener("click", function(e){
    if (!document.body.classList.contains("tabbed")) return;
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var id = a.getAttribute("href").slice(1);
    if (!id) return;
    var target = document.getElementById(id);
    if (!target || !target.classList.contains("section")) return;
    e.preventDefault();
    showSection(id);
    closeMorePanel();
    if (searchInput && searchInput.value) { searchInput.value = ""; renderSearch(""); }
  });

  if (mqMobile.matches) enableTabbed();
  if (mqMobile.addEventListener) {
    mqMobile.addEventListener("change", function(e){ e.matches ? enableTabbed() : disableTabbed(); });
  } else if (mqMobile.addListener) {           // régi Safari
    mqMobile.addListener(function(e){ e.matches ? enableTabbed() : disableTabbed(); });
  }

})();
