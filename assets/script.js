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
  // PWA standalone módban a mailto linkek navigációs eseményt váltanak ki.
  // window.location.href = ... kikényszeríti a mail app megnyitását blank tab nélkül.
  document.querySelectorAll('a[href^="mailto:"]').forEach(function(el) {
    el.addEventListener("click", function(e) {
      e.preventDefault();
      window.location.href = el.getAttribute("href");
    });
  });

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

  var LEZART_STATUSZOK = ["5. Folyósítva", "3. Megkötve"];

  function statuszBadge(statusz) {
    var isLezart = LEZART_STATUSZOK.indexOf(statusz) !== -1;
    var cls = isLezart ? "statusz-badge statusz-badge--lezart" : "statusz-badge";
    return '<span class="' + cls + '">' + statusz + '</span>';
  }

  function renderPipelineTable(data) {
    if (!data.ugyletek || data.ugyletek.length === 0) {
      return '<div class="sajat-empty">Jelenleg nincs aktív ügyleted.</div>';
    }

    var rows = data.ugyletek.map(function(u) {
      var ehStr  = u.eh ? u.eh + " EH" : "—";
      var honap  = u.elszamolasi_honap || "—";
      return (
        "<tr>" +
          "<td>" + u.ugyfel + "</td>" +
          "<td>" + u.termek + "</td>" +
          "<td>" + u.bank + "</td>" +
          "<td>" + statuszBadge(u.statusz) + "</td>" +
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
          "<tr>" +
            "<td>" + u.ugyfel + "</td>" +
            "<td>" + u.termek + "</td>" +
            "<td>" + u.bank + "</td>" +
            "<td>" + statuszBadge(u.statusz) + "</td>" +
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
      })
      .catch(function() {
        sajatTar.innerHTML = '<div class="card"><div class="sajat-empty">Az adatok jelenleg nem elérhetők. Kérjük, próbáld újra később.</div></div>';
      });
  }

  if (partnerToken) {
    if (sajatSection) sajatSection.style.display = "";
    if (sajatNav)     sajatNav.style.display      = "";
    loadPartnerData(partnerToken);
  } else {
    // Nincs token — szekció rejtett, de ha valaki direktben navigál rá, mutatjuk az üzenetet
    if (sajatTar) {
      sajatTar.innerHTML = '<div class="card"><div class="sajat-locked">Ez a nézet személyre szabott — kérd el a saját linkedet Barnától.</div></div>';
    }
  }

})();
