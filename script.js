/* tax calculator logic – yearly summary, animations, and inline tooltips
   v2: responsive tooltips – automatikus oldalra igazítás mobilon */

document.addEventListener("DOMContentLoaded", async () => {
  // --------- Config & helpers ---------
  const rates = await fetch("rates_2025.json").then((r) => r.json());
  const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nf = new Intl.NumberFormat("hu-HU");
  const $ = (id) => document.getElementById(id);

  // Smooth counting animation
  const animateValue = (el, end, duration = 800) => {
    if (prefersReduce) {
      el.textContent = nf.format(Math.round(end));
      return;
    }
    const startTime = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      el.textContent = nf.format(Math.round(end * progress));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // --------- Tooltip logic ---------
  const positionTip = (btn, tip) => {
    // Reset classes
    tip.classList.remove("left-full", "ml-2", "right-full", "mr-2");

    const btnRect = btn.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const spaceRight = window.innerWidth - (btnRect.right + tipRect.width + 8);

    if (spaceRight < 0) {
      // ragasszuk bal oldalra
      tip.classList.add("right-full", "mr-2");
    } else {
      // alap: balról jobbra (az ikon után)
      tip.classList.add("left-full", "ml-2");
    }
  };

  document.querySelectorAll("[data-info]").forEach((btn) => {
    // stílus a gombnak
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

    // létrehozott tooltip
    const tip = document.createElement("div");
    tip.textContent = btn.dataset.info;
    tip.className =
      "absolute z-10 top-1/2 -translate-y-1/2 bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-xs p-2 rounded shadow max-w-xs w-44 break-words hidden";

    const wrapper = btn.parentElement; // label
    wrapper.classList.add("relative");
    wrapper.appendChild(tip);

    // toggle + pozicionálás
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const isHidden = tip.classList.toggle("hidden");
      if (!isHidden) {
        positionTip(btn, tip);
      }
    });

    // Re‑position on window resize (ha nyitva van)
    window.addEventListener("resize", () => {
      if (!tip.classList.contains("hidden")) positionTip(btn, tip);
    });
  });

  // Globális kattintás esetén tooltipek bezárása
  document.addEventListener("click", () => {
    document.querySelectorAll("[data-info]").forEach((btn) => {
      const tip = btn.parentElement.querySelector("div");
      if (tip && !tip.classList.contains("hidden")) tip.classList.add("hidden");
    });
  });

  // --------- Kalkulátor ---------
  const form = $("taxForm");
  const resultBox = $("result");
  let chartInstance = null;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    // --- Inputok ---
    const gross = parseFloat($("gross").value) || 0;
    const children = Math.max(0, parseInt($("children").value || 0, 10));
    const under25 = $("under25").checked;
    const under30Mother = $("under30mother").checked;
    const mother4plus = $("mother4plus").checked;
    const firstMarriage = $("firstMarriage").checked;
    const personalAllowance = $("personalAllowance").checked;
    const spendingInput = parseFloat($("spending").value);

    // --- Kulcsok ---
    const { szja, tb, szocho, afa_standard } = rates.rates;
    let szjaBase = gross;
    let szjaDue = 0;

    // Kedvezmények
    if (mother4plus) {
      szjaBase = 0;
    } else if (under25) {
      szjaBase = 0;
    } else {
      if (under30Mother) {
        const maxMonthly = rates.deductions.young_mothers_under30.max_base_huf / 12;
        szjaBase -= Math.min(maxMonthly, szjaBase);
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
      szjaDue = szjaBase * szja;
    }

    const tbDue = gross * tb;
    const employerDue = gross * szocho;
    const netto = gross - szjaDue - tbDue;

    const spending = isNaN(spendingInput) ? netto : spendingInput;
    const vatDue = spending * (afa_standard / (1 + afa_standard));

    const totalState = szjaDue + tbDue + employerDue + vatDue;

    // Éves
    const nettoY = netto * 12;
    const youY = (szjaDue + tbDue) * 12;
    const empY = employerDue * 12;
    const vatY = vatDue * 12;
    const totalY = totalState * 12;

    // Kiírás
    [
      ["netto", netto],
      ["youPay", szjaDue + tbDue],
      ["employerPay", employerDue],
      ["vatPay", vatDue],
      ["totalState", totalState],
      ["nettoYear", nettoY],
      ["youPayYear", youY],
      ["employerPayYear", empY],
      ["vatPayYear", vatY],
      ["totalStateYear", totalY],
    ].forEach(([id, val]) => animateValue($(id), val));

    if (resultBox.classList.contains("hidden")) {
      resultBox.classList.remove("hidden");
      setTimeout(() => resultBox.classList.remove("opacity-0"), 50);
    }

    // Diagram
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart($("pie"), {
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
