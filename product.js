function productTabs() {
  document.querySelectorAll('[data-product="patient"]').forEach((component) => {
    if (component.dataset.scriptInitialized) return;
    component.dataset.scriptInitialized = "true";

    const tabList = component.querySelector('[data-product="tabs"]');
    const tabs = [...component.querySelectorAll('[data-product="tab-link"]')];
    const panels = [...component.querySelectorAll('[data-product="tab-panel"]')];
    if (!tabs.length || !panels.length) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const getButton = (tab) => tab.querySelector("button") || tab;
    const getPanel = (id) => panels.find((panel) => panel.dataset.productId === id);
    let activeId = null;

    // Accessibility: tablist / tab / tabpanel wiring
    if (tabList) tabList.setAttribute("role", "tablist");
    tabs.forEach((tab) => {
      const id = tab.dataset.productId;
      const button = getButton(tab);
      const panel = getPanel(id);
      button.id = `patient-tab-${id}`;
      button.setAttribute("role", "tab");
      if (panel) {
        panel.id = `patient-panel-${id}`;
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", button.id);
        button.setAttribute("aria-controls", panel.id);
      }
    });

    function activate(id, animate) {
      if (id === activeId) return;
      const prevPanel = getPanel(activeId);
      const nextPanel = getPanel(id);
      if (!nextPanel) return;

      tabs.forEach((tab) => {
        const isActive = tab.dataset.productId === id;
        const button = getButton(tab);
        tab.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
        button.tabIndex = isActive ? 0 : -1;
      });
      panels.forEach((panel) => panel.classList.toggle("is-active", panel === nextPanel));

      // CSS owns the resting state (.is-active); GSAP only runs the crossfade,
      // then clears its inline styles so the CSS takes over again.
      if (animate && !reduceMotion) {
        if (prevPanel) {
          gsap.fromTo(prevPanel,
            { autoAlpha: 1 },
            { autoAlpha: 0, duration: 0.25, ease: "power2.out", overwrite: true, clearProps: "opacity,visibility" }
          );
        }
        gsap.fromTo(nextPanel,
          { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.5, delay: 0.1, ease: "power3.out", overwrite: true, clearProps: "opacity,visibility,transform" }
        );
      }

      activeId = id;
      document.dispatchEvent(new CustomEvent("product:patient-change", { detail: { id, panel: nextPanel } }));
    }

    tabs.forEach((tab, index) => {
      const button = getButton(tab);

      button.addEventListener("click", () => activate(tab.dataset.productId, true));

      // Arrow keys / Home / End move between tabs
      button.addEventListener("keydown", (event) => {
        const keys = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
        if (!(event.key in keys)) return;
        event.preventDefault();
        const next = tabs[(keys[event.key] + tabs.length) % tabs.length];
        getButton(next).focus();
        activate(next.dataset.productId, true);
      });
    });

    const initial = tabs.find((tab) => tab.classList.contains("is-active")) || tabs[0];
    activate(initial.dataset.productId, false);
  });
}

/* Sticky patient card ---------------------------------------------------------
 Hidden through Stage 0, slides in at Stage 1, leaves after Stage 10.
 Desktop: docked at the bottom, slides up from below.
 Tablet and below (≤991px): docked under the nav (clear of the HubSpot chat
 bubble), slides down from above. Following the nav as it hides/shows is CSS.
 Status text comes from each section's data-stage-status; stepper item N maps
 to Stage N. Patient name/photo follow the active hero tab.
---------------------------------------------------------------------------- */
function productSticky() {
document.querySelectorAll('[data-product="sticky-card"]').forEach((component) => {
  if (component.dataset.scriptInitialized) return;
  component.dataset.scriptInitialized = "true";

  const card = component.querySelector(".product_sticky_card");
  const nameEl = component.querySelector('[data-product="sticky-name"]');
  const photoEl = component.querySelector('[data-product="sticky-photo"]');
  const textEl = component.querySelector('[data-product="sticky-text"]');
  const steps = [...component.querySelectorAll('[data-product="sticky-step"]')];
  const stages = [...document.querySelectorAll("[data-stage]")]
    .sort((a, b) => Number(a.dataset.stage) - Number(b.dataset.stage));
  const firstStage = stages.find((stage) => Number(stage.dataset.stage) === 1);
  const lastStage = stages[stages.length - 1];
  if (!card || !firstStage) return;

  gsap.registerPlugin(ScrollTrigger);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const topDocked = window.matchMedia("(max-width: 991px)");
  let currentStage = null;
  let isShown = false;

  // Off-screen direction depends on where the card is docked
  const hiddenY = () => (topDocked.matches ? -120 : 120);

  function setPatient(panel) {
    if (!panel) return;
    const name = panel.querySelector('[data-product="panel-name"]');
    const photo = panel.querySelector('[data-product="panel-photo"]');
    if (name && nameEl) nameEl.textContent = name.textContent.trim();
    if (photo && photoEl) {
      // Copy srcset/sizes too, otherwise the browser keeps the placeholder from srcset
      ["srcset", "sizes"].forEach((attr) => {
        if (photo.hasAttribute(attr)) photoEl.setAttribute(attr, photo.getAttribute(attr));
        else photoEl.removeAttribute(attr);
      });
      photoEl.setAttribute("src", photo.getAttribute("src"));
      photoEl.setAttribute("alt", photo.getAttribute("alt") || "");
      photoEl.loading = "eager";
    }
  }

  function setStage(stageNumber, instant) {
    if (stageNumber === currentStage) return;
    currentStage = stageNumber;

    steps.forEach((step, index) => {
      step.classList.toggle("is-done", index < stageNumber - 1);
      step.classList.toggle("is-active", index === stageNumber - 1);
    });
    document.dispatchEvent(new CustomEvent("product:stage-change", { detail: { stage: stageNumber } }));

    const stage = stages.find((item) => Number(item.dataset.stage) === stageNumber);
    const status = stage && stage.dataset.stageStatus ? stage.dataset.stageStatus.trim() : "";
    if (!status || !textEl || textEl.textContent.trim() === status) return;

    if (instant || reduceMotion) {
      gsap.killTweensOf(textEl);
      gsap.set(textEl, { clearProps: "opacity,visibility,transform" });
      textEl.textContent = status;
      return;
    }

    gsap.to(textEl, {
      autoAlpha: 0, y: -6, duration: 0.15, ease: "power2.in", overwrite: true,
      onComplete: () => {
        textEl.textContent = status;
        gsap.fromTo(textEl, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out" });
      },
    });
  }

  function show() {
    isShown = true;
    gsap.to(card, { yPercent: 0, autoAlpha: 1, duration: reduceMotion ? 0 : 0.6, ease: "power3.out", overwrite: true });
  }

  function hide() {
    isShown = false;
    document.dispatchEvent(new CustomEvent("product:sticky-hide"));
    gsap.to(card, { yPercent: hiddenY(), autoAlpha: 0, duration: reduceMotion ? 0 : 0.4, ease: "power2.in", overwrite: true });
  }

  // Normalise the CSS starting state into GSAP's transform, on the correct side
  gsap.set(card, { y: 0, yPercent: hiddenY(), autoAlpha: 0 });

  // Crossing 991px while hidden: move the parked card to the other side
  topDocked.addEventListener("change", () => {
    if (!isShown) gsap.set(card, { yPercent: hiddenY() });
  });

  // Initial content
  setPatient(
    document.querySelector('[data-product="tab-panel"].is-active') ||
    document.querySelector('[data-product="tab-panel"]')
  );
  setStage(1, true);
  document.addEventListener("product:patient-change", (event) => setPatient(event.detail.panel));

  // Visible from Stage 1 through the end of the last stage
  ScrollTrigger.create({
    trigger: firstStage,
    endTrigger: lastStage,
    start: "top 60%",
    end: "bottom 60%",
    onToggle: (self) => (self.isActive ? show() : hide()),
  });

  // Status + stepper per stage
  stages.forEach((stage) => {
    const stageNumber = Number(stage.dataset.stage);
    if (stageNumber < 1) return;
    ScrollTrigger.create({
      trigger: stage,
      start: "top 60%",
      end: "bottom 60%",
      onToggle: (self) => { if (self.isActive) setStage(stageNumber); },
    });
  });
});
}

/* Scroll to a stage ------------------------------------------------------------
 Shared by both stage menus. Smooth-scrolls with Lenis (stopping a nav-height
 above the section so the nav doesn't cover it when it slides back), keeps
 the URL hash shareable, and moves focus to the section for keyboard users.
---------------------------------------------------------------------------- */
function productScrollTo(target) {
if (!target) return;
const root = document.documentElement;
const navHeight =
  parseFloat(getComputedStyle(root).getPropertyValue("--nav-height")) *
    parseFloat(getComputedStyle(root).fontSize) || 0;

const focusTarget = () => {
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
};

if (window.lenis) {
  window.lenis.scrollTo(target, { offset: -navHeight, onComplete: focusTarget });
} else {
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  focusTarget();
}
history.replaceState(null, "", "#" + target.id);
}

// Wire any same-page #anchor links inside `scope` to productScrollTo. Returns the links.
function productStageLinks(scope, onPick) {
const links = [...scope.querySelectorAll('a[href^="#"]')];
links.forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.getElementById(link.getAttribute("href").slice(1));
    if (!target) return;
    event.preventDefault();
    if (onPick) onPick(link, target);
    productScrollTo(target);
  });
});
return links;
}

/* Sticky card stage menu --------------------------------------------------------
 The toggle covers the whole card. Opening adds .is-open to the card, the menu
 and the chevron. Closes on Escape, outside click, picking a stage, or when the
 card hides. Current stage comes from productSticky() ("product:stage-change").
---------------------------------------------------------------------------- */
function productStickyMenu() {
document.querySelectorAll('[data-product="sticky-card"]').forEach((component) => {
  if (component.dataset.menuInitialized) return;
  component.dataset.menuInitialized = "true";

  const card = component.querySelector(".product_sticky_card");
  const toggle = component.querySelector('[data-product="sticky-toggle"]');
  const menu = component.querySelector('[data-product="sticky-menu"]');
  const chevron = component.querySelector(".product_sticky_chevron");
  const scroller = menu && menu.querySelector(".product_sticky_menu_inner");
  const items = menu ? [...menu.querySelectorAll('[data-product="sticky-menu-link"]')] : [];
  if (!card || !toggle || !menu || !items.length) return;

  let isOpen = false;

  function setOpen(open, { returnFocus = false } = {}) {
    if (open === isOpen) return;
    isOpen = open;
    [card, menu, chevron].forEach((el) => el && el.classList.toggle("is-open", open));
    toggle.setAttribute("aria-expanded", String(open));

    // Bring the current stage into view inside the menu
    if (open && scroller) {
      const current = menu.querySelector(".product_sticky_menu_item.is-current");
      if (current) scroller.scrollTop = current.offsetTop - scroller.clientHeight / 2 + current.offsetHeight / 2;
    }
    if (!open && returnFocus) toggle.focus();
  }

  function setCurrent(stageNumber) {
    items.forEach((item) => {
      const isCurrent = Number(item.dataset.stageTarget) === stageNumber;
      const link = item.querySelector("a");
      item.classList.toggle("is-current", isCurrent);
      if (link) {
        if (isCurrent) link.setAttribute("aria-current", "step");
        else link.removeAttribute("aria-current");
      }
    });
  }

  toggle.addEventListener("click", () => setOpen(!isOpen));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) setOpen(false, { returnFocus: true });
  });

  document.addEventListener("pointerdown", (event) => {
    if (isOpen && !card.contains(event.target)) setOpen(false);
  });

  productStageLinks(menu, () => setOpen(false));

  document.addEventListener("product:stage-change", (event) => setCurrent(event.detail.stage));
  document.addEventListener("product:sticky-hide", () => setOpen(false));

  const steps = [...component.querySelectorAll('[data-product="sticky-step"]')];
  const activeIndex = steps.findIndex((step) => step.classList.contains("is-active"));
  if (activeIndex > -1) setCurrent(activeIndex + 1);
});
}

// Load Swiper once per page. Shares window.swiperLoader with the [data-carousel] embed,
// so whichever runs first loads it and the other reuses it.
function productLoadSwiper() {
if (window.Swiper) return Promise.resolve(window.Swiper);
if (!window.swiperLoader) {
  window.swiperLoader = new Promise((resolve, reject) => {
    const version = "11.1.14";
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `https://cdn.jsdelivr.net/npm/swiper@${version}/swiper-bundle.min.css`;
    document.head.appendChild(css);

    const js = document.createElement("script");
    js.src = `https://cdn.jsdelivr.net/npm/swiper@${version}/swiper-bundle.min.js`;
    js.onload = () => resolve(window.Swiper);
    js.onerror = reject;
    document.head.appendChild(js);
  });
}
return window.swiperLoader;
}

/* Jump menu under the hero -----------------------------------------------------
 Swiper row of stage cards with the arrows in the header (outside the slider,
 so it's set up here rather than by the shared [data-carousel] script).
 Toggles .is-end on the slider so the right-edge fade drops at the end.
---------------------------------------------------------------------------- */
function productJumpMenu() {
document.querySelectorAll(".product_jump_section").forEach((section) => {
  if (section.dataset.scriptInitialized) return;
  section.dataset.scriptInitialized = "true";

  const slider = section.querySelector(".product_jump_slider");
  const wrapper = slider && slider.querySelector(".swiper-wrapper");
  const prev = section.querySelector('[data-carousel="prev"]');
  const next = section.querySelector('[data-carousel="next"]');
  if (!slider || !wrapper) return;

  // Links work with or without Swiper
  productStageLinks(slider);

  [prev, next].forEach((button) => button && button.setAttribute("type", "button"));

  productLoadSwiper().then((Swiper) => {

    // Use the gap set in Webflow as Swiper's spacing (and remove the CSS gap so it isn't doubled)
    const gap = parseFloat(getComputedStyle(wrapper).columnGap) || 0;
    wrapper.style.gap = "0px";

    const setEdges = (swiper) => {
      slider.classList.toggle("is-start", swiper.isBeginning);
      slider.classList.toggle("is-end", swiper.isEnd);
    };

    new Swiper(slider, {
      slidesPerView: "auto", // card widths come from Webflow
      slidesPerGroupAuto: true, // each arrow click moves a full screen of cards, not one
      spaceBetween: gap,
      speed: 600,
      grabCursor: true,
      watchOverflow: true, // no arrows or fade when everything fits
      mousewheel: { forceToAxis: true }, // trackpad side-swipes scroll the row; vertical scrolling passes to the page
      keyboard: { enabled: true, onlyInViewport: true },
      a11y: {
        enabled: true,
        prevSlideMessage: "Previous stages",
        nextSlideMessage: "Next stages",
      },
      navigation: { prevEl: prev, nextEl: next },
      on: {
        afterInit: setEdges,
        slideChange: setEdges,
        reachBeginning: setEdges,
        reachEnd: setEdges,
        fromEdge: setEdges,
        resize: setEdges,
      },
    });
  }).catch(() => {
    section.dataset.scriptInitialized = "";
  });
});
}

/* Journey line ----------------------------------------------------------------
   Each [data-indicator="fill"] grows to fill its line as that line passes the
   middle of the viewport. Segments touch end to end, so together they draw one
   continuous line. Dots get .is-active once reached and .is-current for the
   most recent one.
---------------------------------------------------------------------------- */
function productIndicator() {
  const fills = [...document.querySelectorAll('[data-indicator="fill"]')];
  const dots = [...document.querySelectorAll('[data-indicator="dot"]')];
  if (!fills.length && !dots.length) return;

  gsap.registerPlugin(ScrollTrigger);

  // Everything before the first dot (Stage 0's lead-in lines) and the first dot
  // itself start in the active state, so the hero lines flow straight into it.
  const firstDot = dots[0];
  const isBeforeFirstDot = (element) =>
    firstDot && Boolean(element.compareDocumentPosition(firstDot) & Node.DOCUMENT_POSITION_FOLLOWING);

  fills.forEach((fill) => {
    if (fill.dataset.scriptInitialized) return;
    fill.dataset.scriptInitialized = "true";

    const line = fill.parentElement;
    if (!line || line.offsetParent === null) return; // skip lines hidden with display:none

    gsap.set(fill, { transformOrigin: "top center" });

    if (isBeforeFirstDot(line)) {
      gsap.set(fill, { scaleY: 1 });
      return;
    }

    gsap.fromTo(fill,
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: "none",
        scrollTrigger: { trigger: line, start: "top 50%", end: "bottom 50%", scrub: true },
      }
    );
  });

  const triggers = [];

  function updateDots() {
    let current = 0; // first dot is always reached
    triggers.forEach((trigger, index) => {
      const isActive = index === 0 || trigger.isActive;
      dots[index].classList.toggle("is-active", isActive);
      if (isActive) current = index;
    });
    dots.forEach((dot, index) => dot.classList.toggle("is-current", index === current));
  }

  dots.forEach((dot) => {
    if (dot.dataset.scriptInitialized) return;
    dot.dataset.scriptInitialized = "true";
    // "top 50%" = the moment the drawing line reaches the top of the dot
    triggers.push(ScrollTrigger.create({ trigger: dot, start: "top 50%", end: "max", onToggle: updateDots }));
  });

  updateDots();
}

/* Theme changer ---------------------------------------------------------------
   Portable: works on any [data-theme-animation="wrap"]. The whole wrap shares
   ONE active theme at a time, so text and background always match.
   1. Finds every --_theme---* token in the site's CSS.
   2. Reads each top-level section's values for those tokens (from its variant).
   3. Points every section's tokens at wrap-level "--theme-active-*" variables.
   4. Tweens those wrap-level variables + the wrap background when a section
      takes over, so every section in the wrap changes theme together.
   Adds .is-ready to the wrap (gates the transparency CSS) and mirrors the
   active section's data-theme onto the wrap as data-theme-current.
---------------------------------------------------------------------------- */
function themeChanger() {
  document.querySelectorAll('[data-theme-animation="wrap"]').forEach((wrap) => {
    if (wrap.dataset.scriptInitialized) return;
    wrap.dataset.scriptInitialized = "true";

    // Top-level sections only (ignore sections nested inside another section in this wrap)
    const sections = [...wrap.querySelectorAll("section")].filter((section) => {
      const parent = section.parentElement.closest("section");
      return !parent || !wrap.contains(parent);
    });
    if (!sections.length) return;

    gsap.registerPlugin(ScrollTrigger);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tokenPrefix = "--_theme---";
    const activePrefix = "--theme-active-";

    // Collect every theme token name defined anywhere in the site's CSS
    function getTokenNames() {
      const names = new Set();
      function collect(rules) {
        [...rules].forEach((rule) => {
          if (rule.style) {
            for (let i = 0; i < rule.style.length; i++) {
              if (rule.style[i].startsWith(tokenPrefix)) names.add(rule.style[i]);
            }
          }
          if (rule.cssRules) collect(rule.cssRules); // @media, @container, nesting
        });
      }
      [...document.styleSheets].forEach((sheet) => {
        try { collect(sheet.cssRules); } catch (error) { /* cross-origin sheet without CORS */ }
      });
      return [...names];
    }

    const tokens = getTokenNames();

    // Read colours + token values BEFORE anything is overridden
    const items = sections.map((section) => {
      const styles = getComputedStyle(section);
      let background = styles.backgroundColor;
      if (!background || background === "transparent" || background === "rgba(0, 0, 0, 0)") {
        background = styles.getPropertyValue(`${tokenPrefix}background`).trim();
      }
      const values = {};
      tokens.forEach((token) => {
        const value = styles.getPropertyValue(token).trim();
        if (value) values[token.replace(tokenPrefix, activePrefix)] = value;
      });
      return { section, background, values, theme: section.dataset.theme || "" };
    });

    function setTheme(item, instant) {
      if (item.theme) wrap.dataset.themeCurrent = item.theme;
      gsap.to(wrap, {
        backgroundColor: item.background,
        ...item.values,
        duration: instant || reduceMotion ? 0 : 0.6,
        ease: "power2.out",
        overwrite: true,
      });
    }

    // Set the first theme on the wrap, THEN point the sections at it
    setTheme(items[0], true);
    // (each section's own value stays as the fallback)
    items.forEach((item) => {
      tokens.forEach((token) => {
        const activeName = token.replace(tokenPrefix, activePrefix);
        const fallback = item.values[activeName];
        item.section.style.setProperty(token, fallback ? `var(${activeName}, ${fallback})` : `var(${activeName})`);
      });
    });
    wrap.classList.add("is-ready");

    items.forEach((item) => {
      ScrollTrigger.create({
        trigger: item.section,
        start: "top 50%",
        end: "bottom 50%",
        onToggle: (self) => { if (self.isActive) setTheme(item); },
      });
    });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  themeChanger();
  productTabs();
  productSticky();
  productStickyMenu();
  productJumpMenu();
  productIndicator();
});