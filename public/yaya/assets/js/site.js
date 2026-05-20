/* ============================================================
   Yaya Chen — portfolio interactions
   Vanilla, dependency-free. Two responsibilities:
     1. Scroll-reveal via IntersectionObserver (reduced-motion aware)
     2. Native <dialog> lightbox with keyboard navigation
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Scroll reveal -------------------------------------- */
  var revealables = document.querySelectorAll("[data-reveal]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealables.forEach(function (el) { el.classList.add("is-in"); });
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
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---- Lightbox ------------------------------------------- */
  var dialog = document.getElementById("lightbox");
  var lbImg  = document.getElementById("lb-img");
  var closeBtn = dialog && dialog.querySelector(".lb-close");

  if (!dialog || !lbImg || typeof HTMLDialogElement === "undefined") return;

  // All lightbox triggers in document order (gallery = the whole page)
  var triggers = Array.prototype.slice.call(document.querySelectorAll("[data-lightbox]"));
  var index = 0;

  function show(i) {
    if (!triggers.length) return;
    index = (i + triggers.length) % triggers.length;
    var t = triggers[index];
    lbImg.src = t.getAttribute("data-full");
    lbImg.alt = t.getAttribute("data-caption") || "";
  }

  function openFrom(trigger) {
    show(triggers.indexOf(trigger));
    if (!dialog.open) dialog.showModal();
  }

  triggers.forEach(function (t) {
    t.addEventListener("click", function () { openFrom(t); });
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", function () { dialog.close(); });
  }

  // Click outside the image area closes
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog) dialog.close();
  });

  // Keyboard: arrows to navigate, esc closes (esc is native to <dialog>)
  dialog.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
    if (e.key === "ArrowLeft")  { e.preventDefault(); show(index - 1); }
  });

  // Refresh trigger list once after first paint (the Graphic grid is
  // populated by an inline script that runs before this one, but a
  // safety re-query catches any later additions).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      triggers = Array.prototype.slice.call(document.querySelectorAll("[data-lightbox]"));
      triggers.forEach(function (t) {
        if (!t.__lbBound) {
          t.__lbBound = true;
          t.addEventListener("click", function () { openFrom(t); });
        }
      });
    });
  }
})();
