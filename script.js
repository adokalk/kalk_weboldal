/* ----------------------------------------------
   Magyar „Mennyit fizetsz az államnak?” kalkulátor
   v4 – 2025.05
   • Éves összesítés, animált számok, kördiagram (Chart.js)
   • Responsive tooltip – mindig viewporton belül
   • Egy időben csak egy tooltip látható; gomb színe visszavált
------------------------------------------------*/

document.addEventListener("DOMContentLoaded", async () => {
  // ---------- Konfiguráció & helper függvények ----------
  const rates = await fetch("rates_2025.json").then((r) => r.json());
  const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nf = new Intl.NumberFormat("hu-HU");
  const $ = (id) => document.getElementById(id);

  // "számgördülés" animáció
  function animateValue(el, end, duration = 800) {
    if (prefersReduce) {
      el.textContent = nf.format(Math.round(end));
      return;
    }
    const start = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - start) / duration);
      el.textContent = nf.format(Math.round(end * p));
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }

  // ---------- Tooltip-kezelés ----------
  const infoButtons = document.querySelectorAll("[data-info]");

  // bezár minden tooltipet és reseteli a gomb színét
  function closeAllTips() {
    infoButtons.forEach((btn) => {
      const tip = btn._tip;
      if (tip && !tip.classList.contains("hidden")) tip.classList.add("hidden");
      btn.classList.remove("bg-blue-500", "text-white");
    });
  }

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  infoButtons.forEach((btn) => {
    // alap stílusok a gombnak
    btn.classList.add(
      "inline-flex",
      "items-center",
      "justify-center",
      "w-5",
      "h-5",
      "rounded-full",
      "border",
      "border-blue-500",
      "text-blue-500",
      "text-xs",
      "font-bold",
      "hover:bg-blue-500",
      "hover:text-white",
      "focus:outline-none"
    );

    // tooltip elem létrehozása (fixed → body)
    const tip = document.createElement("div");
    tip.textContent = btn.dataset.info;
    tip.className =
      "fixed z-50 bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-xs p-2 rounded shadow max-w-xs w-48 break-words hidden";
    document.body.appendChild(tip);
    btn._tip = tip; // referenciarögzítés

    // pozicionálás viewporton belül
    function positionTip() {
      const margin = 8;
      const br = btn.getBoundingClientRect();
      const tr = tip.getBoundingClientRect();

      // prefer jobbra
      let x = br.right + margin;
      let y = br.top + br.height / 2 - tr.height / 2;

      // ha kilóg jobbra ⇒ balra
      if (x + tr.width > window.innerWidth - margin) {
        x = br.left - margin - tr.width;
      }
      // ha balra is kilóg ⇒ közép (gomb alatt)
      if (x < margin) {
        x = clamp(window.innerWidth / 2 - tr.width / 2, margin, window.innerWidth - tr.width - margin);
      }
      // függőleges clamp
      y = clamp(y, margin, window.innerHeight - tr.height - margin);

      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
    }

    // kattintás a gombon
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willShow = tip.classList.contains("hidden");
      closeAllTips();
      if (willShow) {
        tip.classList.remove("hidden");
        btn.classList.add("bg-blue-500", "text-white");
        positionTip();
      }
    });

    // ablakméret változáskor reposition
    window.addEventListener("resize", () => {
      if (!tip.classList.contains("hidden")) positionTip();
    });
  });

  // bárhová kattintva bezár minden tooltipet
  document.addEventListener("click", closeAllTips);

  // ---------- Kalkulátor ----------
  const form = $("taxForm");
  const resultBox = $("result");
  let chart;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    // bemenetek
    const gross = parseFloat($("gross").value) || 0;
    const children = Math.max(0, parseInt($("children").value || 0, 10));
    const under25 = $("under25").checked;
    const under30Mother = $("under30mother").checked;
    const mother4plus = $("mother4plus").checked;
    const firstMarriage = $("firstMarriage").checked;
    const personalAllowance = $("personalAllowance").checked;
    const spendingInput = parseFloat($("spending").value);

    // kulcsok
    const { szja, tb, szocho, afa_standard } = rates.rates;
    let szjaBase = gross;

    // kedvezmények NAV-sorrendben
    if (mother4plus) {
      szjaBase = 0;
    } else if (under25) {
      szjaBase = 0;
    } else {
      if (under30Mother) {
        const max = rates.deductions.young_mothers_under30.max_base_huf / 12;
        szjaBase -= Math.min(max, szjaBase);
      }
      if (personalAllowance) {
        szjaBase -= Math.min(rates.deductions.personal_allowance.monthly_huf, szjaBase);
      }
      if (firstMarriage) {
        szjaBase -= Math.min(rates.deductions.first_marriage.monthly_huf, szjaBase);
      }
      if (children > 0) {
        const now = new Date();
        const key = now.getFullYear() === 2025 && now.getMonth() >= 6 ? "from_2025_07_01" : "before_2025_07_01";
        const arr = rates.deductions.family_allowance.thresholds[key];
        const idx = Math.min(children, 3) - 1;
        const fa = idx >= 0 ? (children >= 3 ? arr[2] * children : arr[idx]) : 0;
        szjaBase -= Math.min(fa, szjaBase);
      }
    }
    const szjaDue = szjaBase * szja;

    // járulékok, nettó
    const tbDue = gross * tb;
    const employerDue = gross * szocho;
    const netto = gross - szjaDue - tbDue;

    // ÁFA
    const spending = isNaN(spendingInput) ? netto : spendingInput;
    const vatDue = spending * (afa_standard / (1 + afa_standard));

    const totalState = szjaDue + tbDue + employerDue + vatDue;
    const yearly = (v) => v * 12;

    // kiírás + animáció
    const pairs = [
      ["netto", netto],
      ["youPay", szjaDue + tbDue],
      ["employerPay", employerDue],
      ["vatPay", vatDue],
      ["totalState", totalState],
      ["nettoYear", yearly(netto)],
      ["youPayYear", yearly(szjaDue + tbDue)],
      ["employerPayYear", yearly(employerDue)],
      ["vatPayYear", yearly(vatDue)],
      ["totalStateYear", yearly(totalState)],
    ];
    pairs.forEach(([id, val]) => animateValue($(id), val));

    // eredmény panel megjelenítése (fade-in)
    if (resultBox.classList.contains("hidden")) {
      resultBox.classList.remove("hidden");
      setTimeout(() => resultBox.classList.remove("opacity-0"), 50);
    }

    // kördiagram
    if (chart) chart.destroy();
    chart = new Chart($("pie"), {
      type: "pie",
      data: {
        labels: ["Te (SZJA+TB)", "Munkaadó (Szocho)", "ÁFA"],
        datasets: [{ data: [szjaDue + tbDue, employerDue, vatDue] }],
      },
      options: {
        animation: prefersReduce ? false : { animateRotate: true, duration: 700 },
        plugins: { legend: { position: "bottom" } },
      },
    });
  });
});
