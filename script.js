/* ==========================================================================
   VEXVER — script.js
   Vanilla JS. No frameworks, no build step.

   Structure of this file:
   1. Data          — one object describing every service's price + fields
   2. Rendering     — turns that data into the configurator's HTML
   3. Pricing       — reads the rendered DOM and recomputes the total
   4. Wiring        — nav toggle, service cards, configurator, request form
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     1. DATA
     Reused pieces (the add-on list that repeats across Premium, Custom,
     Refresh and Upgrade) are defined once and referenced everywhere so
     prices only ever need to change in one place.
  ------------------------------------------------------------------ */

  // The add-on set shared by Premium / Custom / Refresh / Upgrade
  const STANDARD_ADDONS = [
    { id: "snowblind", label: "Snowblind mod", price: 2000, type: "checkbox" },
    { id: "benchmark", label: "Benchmark", price: 200, type: "checkbox" },
    { id: "games", label: "Test ve hrách", perUnit: 200, type: "games", min: 1, max: 5, unitNoun: "her" },
    { id: "optimalizace", label: "Optimalizace", price: 500, type: "checkbox" },
    { id: "apps", label: "Základní aplikace", price: 100, type: "checkbox" },
    { id: "report", label: "Build Report", price: 200, type: "checkbox" }
  ];

  const SERVICES = {

    classic: {
      title: "CLASSIC",
      desc: "Pro zákazníky, kteří už mají vybrané komponenty.",
      base: { label: "Sestavení + test funkčnosti", price: 1500 },
      addons: [
        { id: "snowblind", label: "Snowblind mod", price: 2000, type: "checkbox" }
      ],
      submitLabel: "Continue"
    },

    premium: {
      title: "PREMIUM",
      desc: "Kompletní sestavení, testování a optimalizace.",
      base: { label: "Sestavení + test funkčnosti", price: 1500 },
      addons: STANDARD_ADDONS,
      submitLabel: "Continue"
    },

    custom: {
      title: "VEXVER CUSTOM",
      desc: "PC navržené kompletně podle vašich priorit.",
      base: { label: "Sestavení + test funkčnosti", price: 2000 },
      // Collected before the priced add-ons — this is information, not a price input.
      preFields: [
        { id: "budget", type: "text", label: "Rozpočet", placeholder: "např. 35 000 Kč" },
        {
          id: "usage", type: "checkboxGroup", groupLabel: "Využití", options: [
            "Gaming", "School / Work", "Streaming", "Video editing", "3D / Rendering", "Other"
          ]
        },
        { id: "games_text", type: "text", label: "Jaké hry budeš hrát?" },
        {
          id: "priorities", type: "checkboxGroup", groupLabel: "Priority", options: [
            "Maximum FPS", "Quiet operation", "Appearance", "RGB", "Low power consumption", "Future upgrades", "Best price/performance"
          ]
        },
        {
          id: "condition", type: "radioGroup", groupLabel: "Component condition", options: [
            "New components", "Used components", "Combination of new and used"
          ]
        },
        {
          id: "appearance", type: "radioGroup", groupLabel: "Appearance", options: [
            "Black", "White", "Other"
          ]
        },
        {
          id: "rgb", type: "radioGroup", groupLabel: "Additional options", options: [
            "RGB", "No RGB"
          ]
        }
      ],
      addons: STANDARD_ADDONS,
      submitLabel: "Request a configuration",
      note: "You're not choosing exact components here — you're telling VEXVER what you need. We'll prepare the actual configuration for your approval."
    },

    refresh: {
      title: "REFRESH",
      desc: "Nový život pro PC z použitých komponentů.",
      base: { label: "Sestavení + test funkčnosti", price: 3000 },
      addons: STANDARD_ADDONS,
      postFields: [
        { id: "budget", type: "text", label: "Budget" },
        { id: "have", type: "text", label: "What components do you already have?" },
        { id: "reuse", type: "text", label: "What should be reused?" },
        { id: "replace", type: "text", label: "What should be replaced?" },
        { id: "games_text", type: "text", label: "What games do you play?" },
        { id: "notes", type: "textarea", label: "Další informace" }
      ],
      submitLabel: "Continue"
    },

    upgrade: {
      title: "UPGRADE SERVICE",
      desc: "Upgrade existujícího PC a kontrola funkčnosti.",
      base: { label: "Upgrade + test funkčnosti", price: 1500 },
      addons: STANDARD_ADDONS,
      postFields: [
        { id: "current", type: "text", label: "Current PC components" },
        { id: "upgrade_what", type: "text", label: "What do you want to upgrade?" },
        { id: "budget", type: "text", label: "Budget" },
        { id: "purpose", type: "text", label: "Main purpose" },
        { id: "games_text", type: "text", label: "Games" }
      ],
      submitLabel: "Continue"
    }
  };

  /* ------------------------------------------------------------------
     2. RENDERING
  ------------------------------------------------------------------ */

  const formatKc = (n) => n.toLocaleString("cs-CZ") + " Kč";

  function fieldHTML(f) {
    if (f.type === "text") {
      return `
        <div class="cfg-field">
          <label for="f_${f.id}">${f.label}</label>
          <input type="text" id="f_${f.id}" data-field="${f.id}" data-field-label="${f.label}" placeholder="${f.placeholder || ""}">
        </div>`;
    }
    if (f.type === "textarea") {
      return `
        <div class="cfg-field">
          <label for="f_${f.id}">${f.label}</label>
          <textarea id="f_${f.id}" data-field="${f.id}" data-field-label="${f.label}" rows="3"></textarea>
        </div>`;
    }
    if (f.type === "checkboxGroup" || f.type === "radioGroup") {
      const inputType = f.type === "checkboxGroup" ? "checkbox" : "radio";
      const pills = f.options.map((opt, i) => `
        <label class="cfg-pill" data-pill>
          <input type="${inputType}" name="f_${f.id}" value="${opt}" data-field-group="${f.id}" data-field-label="${f.groupLabel}">
          <span>${opt}</span>
        </label>`).join("");
      return `
        <div class="cfg-group">
          <p class="cfg-group-title">${f.groupLabel}</p>
          <div class="cfg-pills">${pills}</div>
        </div>`;
    }
    return "";
  }

  function addonHTML(a) {
    if (a.type === "checkbox") {
      return `
        <label class="cfg-option" data-option>
          <span class="cfg-option-left">
            <input type="checkbox" class="addon-input" data-addon="${a.id}" data-price="${a.price}" data-label="${a.label}">
            ${a.label}
          </span>
          <span class="cfg-option-price">+${formatKc(a.price)}</span>
        </label>`;
    }
    if (a.type === "games") {
      const opts = [];
      for (let i = a.min; i <= a.max; i++) opts.push(`<option value="${i}">${i}</option>`);
      return `
        <div>
          <label class="cfg-option" data-option>
            <span class="cfg-option-left">
              <input type="checkbox" class="addon-input" id="addon_${a.id}" data-addon="${a.id}" data-per-unit="${a.perUnit}" data-label="${a.label}">
              ${a.label}
            </span>
            <span class="cfg-option-price">+${formatKc(a.perUnit)} / hra</span>
          </label>
          <div class="cfg-subselect" id="sub_${a.id}" hidden>
            <label for="count_${a.id}">Počet her</label>
            <select id="count_${a.id}" data-games-count="${a.id}">${opts.join("")}</select>
          </div>
        </div>`;
    }
    return "";
  }

  function renderConfigurator(key) {
    const svc = SERVICES[key];
    const label = document.getElementById("cfgLabel");
    const title = document.getElementById("cfgTitle");
    const desc = document.getElementById("cfgDesc");
    const body = document.getElementById("cfgBody");
    const submit = document.getElementById("cfgSubmit");

    label.textContent = "Configure — " + svc.title;
    title.textContent = svc.title;
    desc.textContent = svc.desc + (svc.note ? "  " + svc.note : "");
    submit.textContent = svc.submitLabel;

    let html = "";

    if (svc.preFields) {
      html += `<div class="cfg-group"><p class="cfg-group-title">Your project</p></div>`;
      html += svc.preFields.map(fieldHTML).join("");
    }

    html += `
      <div class="cfg-group">
        <p class="cfg-group-title">Included</p>
        <label class="cfg-option required" data-option>
          <span class="cfg-option-left">
            <input type="checkbox" checked disabled>
            ${svc.base.label}
            <span class="cfg-option-tag">required</span>
          </span>
          <span class="cfg-option-price">${formatKc(svc.base.price)}</span>
        </label>
      </div>`;

    if (svc.addons && svc.addons.length) {
      html += `
        <div class="cfg-group">
          <p class="cfg-group-title">Optional</p>
          ${svc.addons.map(addonHTML).join("")}
        </div>`;
    }

    if (svc.postFields) {
      html += `<div class="cfg-group"><p class="cfg-group-title">Tell us more</p></div>`;
      html += svc.postFields.map(fieldHTML).join("");
    }

    body.innerHTML = html;

    // Mark the required base row as visually "checked"
    body.querySelector(".cfg-option.required").classList.add("checked");

    computeTotal(svc);
  }

  /* ------------------------------------------------------------------
     3. PRICING — reads the live DOM, so the total is always a direct
     reflection of what's checked. No parallel state to fall out of sync.
  ------------------------------------------------------------------ */

  function computeTotal(svc) {
    const body = document.getElementById("cfgBody");
    let total = svc.base.price;

    body.querySelectorAll(".addon-input").forEach((input) => {
      const option = input.closest(".cfg-option");
      const isGames = input.dataset.perUnit !== undefined;

      if (isGames) {
        const sub = document.getElementById("sub_" + input.dataset.addon);
        if (input.checked) {
          sub.hidden = false;
          const count = parseInt(document.getElementById("count_" + input.dataset.addon).value, 10) || 1;
          total += parseInt(input.dataset.perUnit, 10) * count;
          option.classList.add("checked");
        } else {
          sub.hidden = true;
          option.classList.remove("checked");
        }
      } else {
        if (input.checked) {
          total += parseInt(input.dataset.price, 10);
          option.classList.add("checked");
        } else {
          option.classList.remove("checked");
        }
      }
    });

    document.getElementById("cfgTotal").textContent = formatKc(total);
    return total;
  }

  /* ------------------------------------------------------------------
     4. WIRING
  ------------------------------------------------------------------ */

  let currentServiceKey = null;

  const configurator = document.getElementById("configurator");
  const cfgBody = document.getElementById("cfgBody");
  const serviceGrid = document.getElementById("serviceGrid");

  function openService(key) {
    currentServiceKey = key;
    renderConfigurator(key);
    configurator.hidden = false;

    document.querySelectorAll(".service-card").forEach((c) => {
      c.classList.toggle("active", c.dataset.service === key);
    });

    // Give the panel a moment to render before scrolling to it
    requestAnimationFrame(() => {
      configurator.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function closeConfigurator() {
    configurator.hidden = true;
    currentServiceKey = null;
    document.querySelectorAll(".service-card").forEach((c) => c.classList.remove("active"));
  }

  serviceGrid.addEventListener("click", (e) => {
    const card = e.target.closest(".service-card");
    if (!card) return;
    const key = card.dataset.service;
    if (currentServiceKey === key) { closeConfigurator(); return; }
    openService(key);
  });

  document.getElementById("cfgClose").addEventListener("click", closeConfigurator);

  // Live price updates — delegate both change (checkboxes/selects) events
  cfgBody.addEventListener("change", () => {
    if (currentServiceKey) computeTotal(SERVICES[currentServiceKey]);
  });

  /* -- Continue / Request a configuration ---------------------------
     Builds a plain-text summary of everything selected and drops it
     into the request form, then scrolls the user down to send it.
  ------------------------------------------------------------------ */
  document.getElementById("cfgSubmit").addEventListener("click", () => {
    if (!currentServiceKey) return;
    const svc = SERVICES[currentServiceKey];
    const total = computeTotal(svc);

    const lines = [`Service: ${svc.title}`, `${svc.base.label}: ${formatKc(svc.base.price)}`];

    cfgBody.querySelectorAll(".addon-input").forEach((input) => {
      if (!input.checked) return;
      if (input.dataset.perUnit !== undefined) {
        const count = document.getElementById("count_" + input.dataset.addon).value;
        lines.push(`${input.dataset.label}: ${count}× (+${formatKc(input.dataset.perUnit * count)})`);
      } else {
        lines.push(`${input.dataset.label}: +${formatKc(parseInt(input.dataset.price, 10))}`);
      }
    });

    cfgBody.querySelectorAll("[data-field]").forEach((el) => {
      if (el.value.trim()) lines.push(`${el.dataset.fieldLabel}: ${el.value.trim()}`);
    });

    const groupValues = {};
    cfgBody.querySelectorAll("[data-field-group]:checked").forEach((el) => {
      const key = el.dataset.fieldGroup;
      const label = el.dataset.fieldLabel;
      groupValues[label] = groupValues[label] || [];
      groupValues[label].push(el.value);
    });
    Object.keys(groupValues).forEach((label) => {
      lines.push(`${label}: ${groupValues[label].join(", ")}`);
    });

    lines.push(`TOTAL: ${formatKc(total)}`);

    document.getElementById("fSummary").value = lines.join("\n");
    document.getElementById("fService").value = currentServiceKey;

    // Carry the "Rozpočet" / "Budget" field over to the main form if present
    const budgetField = cfgBody.querySelector('[data-field="budget"]');
    if (budgetField && budgetField.value.trim()) {
      document.getElementById("fBudget").value = budgetField.value.trim();
    }

    document.getElementById("request").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => document.getElementById("fName").focus(), 500);
  });

  /* -- Mobile navigation ---------------------------------------------- */
  const nav = document.querySelector(".nav");
  const navToggle = document.getElementById("navToggle");

  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.querySelectorAll(".nav-mobile a, .nav-mobile .btn").forEach((el) => {
    el.addEventListener("click", () => {
      nav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });

  /* -- Request form submission -----------------------------------------
     Sends the form to Formspree (see the action="" URL on the <form> in
     index.html — set your own form ID there). Submitted with fetch() so
     the visitor stays on the page and sees a status message instead of
     being redirected to Formspree.

     Formspree forwards every submission as an email to the address the
     form was created with (vexver.builds@gmail.com).
  ------------------------------------------------------------------ */
  const requestForm = document.getElementById("requestForm");
  const formStatus = document.getElementById("formStatus");
  const formSubmitBtn = requestForm.querySelector(".form-submit");

  requestForm.addEventListener("submit", (e) => {
    e.preventDefault();

    if (requestForm.action.includes("YOUR_FORM_ID")) {
      formStatus.textContent = "Formspree isn't connected yet — add your form ID in index.html.";
      return;
    }

    formSubmitBtn.disabled = true;
    formStatus.textContent = "Sending…";

    fetch(requestForm.action, {
      method: "POST",
      body: new FormData(requestForm),
      headers: { Accept: "application/json" }
    })
      .then((res) => {
        if (res.ok) {
          formStatus.textContent = "Request sent — we'll get back to you soon.";
          requestForm.reset();
        } else {
          formStatus.textContent = "Something went wrong. Please try again or email us directly.";
        }
      })
      .catch(() => {
        formStatus.textContent = "Something went wrong. Please try again or email us directly.";
      })
      .finally(() => {
        formSubmitBtn.disabled = false;
      });
  });

})();
