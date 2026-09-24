/* ============================================================
   VEXVER — script.js
   - Service selection (only the selected panel is shown)
   - Live price calculation (checkboxes + per-game qty)
   - Config summary injected into the request form
   - Mobile nav + form handling (frontend-ready)
============================================================= */

(function () {
  "use strict";

  /* ---------- Helpers ---------- */

  // Format a number as Czech currency: 1500 -> "1 500 Kč" (non-breaking spaces)
  function formatKc(value) {
    const str = Math.round(value)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0"); // thin/nbsp grouping
    return str + "\u00A0Kč";
  }

  const SERVICE_LABELS = {
    classic: "CLASSIC",
    custom: "VEXVER CUSTOM",
    refresh: "REFRESH",
    upgrade: "UPGRADE SERVICE",
  };

  /* ---------- Element refs ---------- */
  const grid = document.getElementById("serviceGrid");
  const cards = Array.from(grid.querySelectorAll(".service"));
  const panels = Array.from(document.querySelectorAll(".config"));
  const configEmpty = document.getElementById("configEmpty");
  const totalBar = document.getElementById("totalBar");
  const totalValue = document.getElementById("totalValue");
  const reqService = document.getElementById("reqService");

  let activeService = null;

  /* ---------- Price calculation for the active panel ---------- */
  function getConditionFee(panel) {
    if (activeService !== "custom" || !panel) return 0;
    const selected = panel.querySelector('input[name="custom_condition"]:checked');
    return selected ? parseFloat(selected.dataset.conditionFee) || 0 : 0;
  }

  function getServiceTotal(panel) {
    if (!panel) return 0;
    let total = 0;

    panel.querySelectorAll('input[type="checkbox"][data-price]').forEach((cb) => {
      const isRequired = cb.dataset.required === "1";
      if (cb.checked || isRequired) {
        const base = parseFloat(cb.dataset.price) || 0;

        if (cb.dataset.perGame === "1") {
          const select = cb.closest(".opt").querySelector("select[data-games]");
          const games = select ? parseInt(select.value, 10) || 1 : 1;
          total += base * games;
        } else {
          total += base;
        }
      }
    });

    total += getConditionFee(panel);
    return total;
  }

  function updateFinalBudgetPrice(serviceTotal = 0) {
    const budgetInput = document.getElementById("budgetInput");
    const finalPrice = document.getElementById("finalPrice");
    if (!budgetInput || !finalPrice) return;

    const numeric = parseInt((budgetInput.value || "").replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(numeric) || numeric <= 0 || !activeService) {
      finalPrice.textContent = "—";
      return;
    }

    finalPrice.textContent = formatKc(numeric + serviceTotal);
  }

  function recalcTotal() {
    if (!activeService) return;
    const panel = panels.find((p) => p.dataset.panel === activeService);
    if (!panel) return;

    const total = getServiceTotal(panel);
    totalValue.textContent = formatKc(total);
    updateFinalBudgetPrice(total);
  }


  /* ---------- Enable/disable the games <select> with its checkbox ---------- */
  function syncGameSelects(panel) {
    panel.querySelectorAll(".opt--games").forEach((opt) => {
      const cb = opt.querySelector('input[type="checkbox"]');
      const select = opt.querySelector("select[data-games]");
      if (cb && select) select.disabled = !cb.checked;
    });
  }

  /* ---------- Select a service ---------- */
  function selectService(service) {
    activeService = service;

    // Update card active states + ARIA
    cards.forEach((c) => {
      const isActive = c.dataset.service === service;
      c.classList.toggle("is-active", isActive);
      c.setAttribute("aria-pressed", String(isActive));
    });

    // Show only the matching panel
    configEmpty.hidden = true;
    panels.forEach((p) => {
      p.hidden = p.dataset.panel !== service;
    });

    totalBar.hidden = false;

    const panel = panels.find((p) => p.dataset.panel === service);
    if (panel) {
      syncGameSelects(panel);
      syncCustomConditionalFields(panel);
    }

    // Reflect selection in the request form
    if (reqService) reqService.value = SERVICE_LABELS[service] || "";

    recalcTotal();
  }

  /* ---------- Wire up service cards ---------- */
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      selectService(card.dataset.service);
      // Smoothly bring the configurator into view
      document.getElementById("configurator").scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });

  function syncCustomConditionalFields(panel) {
    if (!panel || activeService !== "custom") return;

    const selectedCondition = panel.querySelector('input[name="custom_condition"]:checked');
    const conditionWrap = panel.querySelector("#customConditionDetails");
    const conditionTextarea = panel.querySelector("#custom_condition_details");
    const conditionHint = panel.querySelector("#customConditionHint");

    if (conditionWrap && conditionTextarea) {
      // Detailed preferences are needed only when the customer chooses
      // used components according to their own selection.
      const show = !!selectedCondition && selectedCondition.value === "Použité komponenty";
      conditionWrap.hidden = !show;
      conditionTextarea.required = false;

      if (show) {
        conditionTextarea.placeholder = "Např. CPU a GPU použité, SSD a zdroj nové…";
        if (conditionHint) conditionHint.textContent = "Napiš, které komponenty chceš nové a které použité. Zbytek navrhneme podle rozpočtu, dostupnosti a výsledné sestavy.";
      }
    }

    const selectedColor = panel.querySelector('input[name="custom_color"]:checked');
    const appearanceWrap = panel.querySelector("#customAppearanceDetails");
    const appearanceTextarea = panel.querySelector("#custom_appearance_details");
    if (appearanceWrap && appearanceTextarea) {
      const show = !!selectedColor && selectedColor.value === "Jiná";
      appearanceWrap.hidden = !show;
      appearanceTextarea.required = false;
    }

    // Show the absolute maximum only when the customer allows a sensible
    // budget overrun.
    const budgetFlex = document.getElementById("budgetFlex");
    const budgetMaxWrap = document.getElementById("budgetMaxWrap");
    const budgetMaxInput = document.getElementById("budgetMaxInput");
    const showMax = !!budgetFlex && budgetFlex.value === "flexible";
    if (budgetMaxWrap) budgetMaxWrap.hidden = !showMax;
    if (!showMax && budgetMaxInput) budgetMaxInput.value = "";
  }

  /* ---------- Listen for any change inside configurator ---------- */
  document.getElementById("configurator").addEventListener("change", (e) => {
    const panel = e.target.closest(".config");
    if (panel) {
      syncGameSelects(panel);
      syncCustomConditionalFields(panel);
    }
    recalcTotal();
  });

  const budgetInput = document.getElementById("budgetInput");
  if (budgetInput) {
    budgetInput.addEventListener("input", () => {
      recalcTotal();
    });
  }

  const budgetFlex = document.getElementById("budgetFlex");
  if (budgetFlex) {
    budgetFlex.addEventListener("change", () => {
      const panel = panels.find((p) => p.dataset.panel === activeService);
      if (panel) syncCustomConditionalFields(panel);
      recalcTotal();
    });
  }


  /* ============================================================
     MOBILE NAVIGATION
  ============================================================= */
  const navToggle = document.getElementById("navToggle");
  const navDrawer = document.getElementById("navDrawer");

  navToggle.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!open));
    navDrawer.hidden = open;
  });

  // Close the drawer after navigating
  navDrawer.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      navToggle.setAttribute("aria-expanded", "false");
      navDrawer.hidden = true;
    });
  });

  /* ============================================================
     CONFIG SUMMARY -> REQUEST FORM
     Collects data-collect fields + selected priced options
     and renders them into the request form before sending.
  ============================================================= */
  function buildSummary() {
    const summaryWrap = document.getElementById("configSummary");
    const summaryBody = document.getElementById("summaryBody");
    const configHidden = document.getElementById("configHidden");

    if (!activeService) {
      summaryWrap.hidden = true;
      return;
    }

    const panel = panels.find((p) => p.dataset.panel === activeService);
    if (!panel) return;

    const rows = [];

    // 1) Collected free-text / choice inputs (Custom, Refresh, Upgrade)
    const grouped = {};
    panel.querySelectorAll("[data-collect]").forEach((input) => {
      const name = input.name || "field";
      if (input.type === "checkbox" || input.type === "radio") {
        if (!input.checked) return;
        grouped[name] = grouped[name] || [];
        grouped[name].push(input.value);
      } else if (input.value.trim()) {
        grouped[name] = [input.value.trim()];
      }
    });

    Object.keys(grouped).forEach((name) => {
      rows.push({ label: prettyName(name), value: grouped[name].join(", ") });
    });

    // 2) Selected priced services
    const selected = [];
    panel
      .querySelectorAll('input[type="checkbox"][data-price]')
      .forEach((cb) => {
        const required = cb.dataset.required === "1";
        if (cb.checked || required) {
          const label = cb
            .closest(".opt")
            .querySelector(".opt__label")
            .textContent.trim();
          if (cb.dataset.perGame === "1") {
            const select = cb.closest(".opt").querySelector("select[data-games]");
            const games = select ? select.value : "1";
            selected.push(`${label} × ${games}`);
          } else {
            selected.push(label);
          }
        }
      });

    if (selected.length) {
      rows.push({ label: "Selected services", value: selected.join(" • ") });
    }

    const serviceTotal = getServiceTotal(panel);
    rows.push({ label: "Cena služeb", value: formatKc(serviceTotal) });

    const budgetField = document.getElementById("budgetInput");
    const budgetValue = budgetField ? parseInt((budgetField.value || "").replace(/[^0-9]/g, ""), 10) : NaN;
    if (Number.isFinite(budgetValue) && budgetValue > 0) {
      rows.push({ label: "Rozpočet na komponenty", value: formatKc(budgetValue) });
      rows.push({ label: "Předběžná cena celkem", value: formatKc(budgetValue + serviceTotal) });
    }

    const budgetFlex = document.getElementById("budgetFlex");
    if (budgetFlex && budgetFlex.value) {
      rows.push({ label: "Přesah rozpočtu", value: budgetFlex.options[budgetFlex.selectedIndex].textContent });
    }

    const budgetMaxInput = document.getElementById("budgetMaxInput");
    const budgetMaxValue = budgetMaxInput ? parseInt((budgetMaxInput.value || "").replace(/[^0-9]/g, ""), 10) : NaN;
    if (budgetFlex && budgetFlex.value === "flexible" && Number.isFinite(budgetMaxValue) && budgetMaxValue > 0) {
      rows.push({ label: "Celkový maximální rozpočet", value: formatKc(budgetMaxValue) });
    }

    // Render
    summaryBody.innerHTML =
      '<dl>' +
      rows
        .map(
          (r) =>
            `<div class="sum-row"><dt>${escapeHtml(r.label)}</dt><dd>${escapeHtml(
              r.value
            )}</dd></div>`
        )
        .join("") +
      "</dl>";

    // Machine-readable payload for a future backend
    configHidden.value = JSON.stringify({
      service: SERVICE_LABELS[activeService],
      details: rows,
    });

    summaryWrap.hidden = false;
  }

  function prettyName(name) {
    return name
      .replace(/^(custom|refresh|upgrade)_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* ============================================================
     REQUEST FORM SUBMISSION (frontend-ready)
     No backend is wired yet — we build the summary, validate,
     and show a confirmation. To connect Formspree/EmailJS later,
     replace the block marked below.
  ============================================================= */
  const form = document.getElementById("requestForm");
  const formStatus = document.getElementById("formStatus");

  // Rebuild summary whenever the user focuses/opens the form area
  form.addEventListener("focusin", buildSummary);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    buildSummary();

    // Basic validation
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    if (!name || !email) {
      showStatus("Please fill in your name and email.", false);
      return;
    }

    /* ----------------------------------------------------------
       BACKEND HOOK — replace this block to actually send data.
       Example (Formspree):
         fetch("https://formspree.io/f/XXXX", {
           method: "POST",
           headers: { "Accept": "application/json" },
           body: new FormData(form),
         }).then(...);
    ---------------------------------------------------------- */
    const payload = Object.fromEntries(new FormData(form).entries());
    console.log("[v0] VEXVER request payload:", payload);

    showStatus(
      "Žádost je připravena. VEXVER ji zkontroluje a připraví nabídku.",
      true
    );
    form.querySelector('button[type="submit"]').textContent = "REQUEST READY";
  });

  function showStatus(msg, ok) {
    formStatus.hidden = false;
    formStatus.textContent = msg;
    formStatus.style.borderColor = ok ? "var(--accent)" : "#b04a4a";
    formStatus.style.background = ok
      ? "var(--accent-soft)"
      : "rgba(176,74,74,0.14)";
  }
  /* ============================================================
     SCROLL REVEAL — jen pro sekce se [data-reveal]
     (Jak to funguje, Protokol o sestavení a diagnostice)
  ============================================================= */
const revealTargets = document.querySelectorAll("[data-reveal]");
  if (revealTargets.length && "IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealTargets.forEach((el) => revealObserver.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("in-view"));
  }

  // Kopírování e-mailu do schránky
  const emailBtn = document.getElementById('copyEmailLink');

  if (emailBtn) {
    emailBtn.addEventListener('click', function () {
      const email = 'vexver.builds@gmail.com';

      navigator.clipboard.writeText(email).then(() => {
        const originalText = emailBtn.textContent;
        emailBtn.textContent = 'Zkopírováno! ✓';

        setTimeout(() => {
          emailBtn.textContent = originalText;
        }, 2000);
      }).catch(err => {
        console.error('Chyba při kopírování: ', err);
      });
    });
  }
})();
