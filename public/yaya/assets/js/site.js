/* ============================================================
   Yaya Chen — portfolio interactions
   Vanilla, dependency-free, progressively enhanced.
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ---- Sticky nav ------------------------------------------- */
  var nav = document.querySelector(".site-nav");
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle("is-stuck", window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- Mobile nav ------------------------------------------- */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    var setNav = function (open) {
      links.classList.toggle("is-open", open);
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };
    toggle.addEventListener("click", function () {
      setNav(!links.classList.contains("is-open"));
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) setNav(false);
    });
  }

  /* ---- Scroll reveal ---------------------------------------- */
  var revealables = document.querySelectorAll("[data-reveal]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealables.forEach(function (el) {
      el.classList.add("is-in");
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );
    revealables.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ---- Lightbox --------------------------------------------- */
  var triggers = Array.prototype.slice.call(
    document.querySelectorAll("[data-lightbox]")
  );
  if (!triggers.length || typeof HTMLDialogElement === "undefined") return;

  var dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  dialog.innerHTML =
    '<button class="lb-btn lb-close" type="button" aria-label="Close">✕</button>' +
    '<button class="lb-btn lb-prev" type="button" aria-label="Previous">←</button>' +
    '<button class="lb-btn lb-next" type="button" aria-label="Next">→</button>' +
    '<figure class="lightbox-stage" style="margin:0">' +
    '<img class="lb-img" alt="">' +
    '<figcaption class="lb-cap"></figcaption></figure>';
  document.body.appendChild(dialog);

  var lbImg = dialog.querySelector(".lb-img");
  var lbCap = dialog.querySelector(".lb-cap");
  var group = [];
  var index = 0;

  var show = function (i) {
    index = (i + group.length) % group.length;
    var t = group[index];
    lbImg.src = t.getAttribute("data-full");
    var cap = t.getAttribute("data-caption") || "";
    lbImg.alt = cap;
    lbCap.textContent =
      cap + (group.length > 1 ? "  ·  " + (index + 1) + " / " + group.length : "");
  };

  var openFrom = function (trigger) {
    var name = trigger.getAttribute("data-gallery") || "all";
    group = triggers.filter(function (t) {
      return (t.getAttribute("data-gallery") || "all") === name;
    });
    show(group.indexOf(trigger));
    if (!dialog.open) dialog.showModal();
  };

  triggers.forEach(function (t) {
    t.addEventListener("click", function () {
      openFrom(t);
    });
  });

  dialog.querySelector(".lb-close").addEventListener("click", function () {
    dialog.close();
  });
  dialog.querySelector(".lb-next").addEventListener("click", function () {
    show(index + 1);
  });
  dialog.querySelector(".lb-prev").addEventListener("click", function () {
    show(index - 1);
  });
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") show(index + 1);
    if (e.key === "ArrowLeft") show(index - 1);
  });
})();
