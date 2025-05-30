/* tax calculator logic – v3
   • Éves összesítés, animációk (megmarad)
   • Tooltip most mindig bent marad a viewporton (jobb, bal vagy alul) */

document.addEventListener("DOMContentLoaded", async () => {
  // --------- Config & helpers ---------
  const rates = await fetch("rates_2025.json").then((r) => r.json());
  const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nf = new Intl.NumberFormat("hu-HU");
  const $ = (id) => document.getElementById(id);

  const animateValue = (el, end, duration = 800) => {
    if (prefersReduce) {
      el.textContent = nf.format(Math.round(end));
      return;
    }
    const startTime = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - startTime) / duration);
      el.textContent = nf.format(Math.round(end * p));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // --------- Tooltip logic ---------
  const baseTipClass =
    "absolute z-10 bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-xs p-2 rounded shadow max-w-xs w-44 break-words";

  const positionTip = (btn, tip) => {
    // távolítsunk el korábbi pozícióosztályokat
    tip.classList.remove(
      "left-full",
      "right-full",
      "top-full",
      "-translate-y-1/2",
      "-translate-x-1/2",
      "ml-2",
      "mr-2",
      "mt-2",
      "top-1/2",
      "left-1/2"
    );
    tip.style.left = "";
    tip.style.top = "";

    // alapból jobbra próbálkozunk
    const btnRect = btn.getBoundingClientRect();

    // Először jobbra
    if (btnRect.right + 8 + tip.offsetWidth <= window.innerWidth) {
      tip.classList.add("left-full", "ml-2", "top-1/2", "-translate-y-1/2");
      return;
    }
    // Aztán balra
    if (btnRect.left - 8 - tip.offsetWidth >= 0) {
      tip.classList.add("right-full", "mr-2", "top-1/2", "-translate-y-1/2");
      return;
    }
    // Végül alul középre – mindig elfér
    tip.classList.add("top-full", "mt-2", "left-1/2", "-translate-x-1/2");
  };

  document.querySelectorAll("[data-info]").forEach((btn) => {
    // ikon kinézet
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

    const tip = document.createElement("div");
    tip.textContent = btn.dataset.info;
    tip.className = baseTipClass + " hidden";

    btn.parentElement.classList.add("relative");
    btn.parentElement.appendChild(tip);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const hidden = tip.classList.toggle("hidden");
      if (!hidden) positionTip(btn, tip);
    });

    window.addEventListener("resize", () => {
      if (!tip.classList.contains("hidden")) positionTip(btn, tip);
    });
  });

  // zárjunk minden tooltipet globális kattintásra
  document.addEventListener("click", () => {
    document.querySelectorAll("[data-info]").forEach((b) => {
      const t = b.parentElement.querySelector("div");
      if (t && !t.classList.contains("hidden")) t.classList.add("hidden");
    });
  });

  // --------- Kalkulátor ---------
  const form = $("taxForm");
  const resultBox = $("result");
  let chartInstance = null;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const gross = parseFloat($("gross").value) || 0;
    const children = Math.max(0, parseInt($("children").value || 0, 10));
    const under25 = $("under25").checked;
    const under30Mother = $("under30mother").checked;
    const mother4plus = $("mother4plus").checked;
    const firstMarriage = $("firstMarriage").checked;
    const personalAllowance = $("personalAllowance").checked;
    const spendingInput = parseFloat($("spending").value);

    const { szja, tb, szocho, afa_standard } = rates.rates;
    let szjaBase = gross;
    let szjaDue = 0;

    if (mother4plus) {
      szjaBase = 0;
    } else if (under25) {
      szjaBase = 0;
    } else {
      if (under30Mother) {
        szjaBase -= Math.min(rates.deductions.young_mothers_under30.max_base_huf / 12, szjaBase);
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

    const yearly = (x) => x * 12;

    [
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
    ].forEach(([id, val]) => animateValue($(id), val));

    if (resultBox.classList.contains("hidden")) {
      resultBox.classList.remove("hidden");
      setTimeout(() => resultBox.classList.remove("opacity-0"), 50);
    }

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
