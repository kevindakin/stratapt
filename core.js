// GLOBAL VARIABLES
const durationBase = 0.8;
const durationSlow = 1.2;
const durationFast = 0.4;
const easeBase = "power4.out";

// GENERAL

let lenis = null;

function lenisScroll() {
  lenis = new Lenis({ lerp: 0.08 });
  window.lenis = lenis;

  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);

  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
  });
}

function loader() {
  const wrap = document.querySelector('[data-load="wrap"]');
  const nav = document.querySelector('[data-load="nav"]');

  if (!wrap) {
    if (nav) gsap.set(nav, { autoAlpha: 1 });
    return;
  }

  const heading = wrap.querySelector('[data-load="heading"]');
  const headingEl = heading?.querySelector("h1, h2") || heading;
  const fades = wrap.querySelectorAll('[data-load="fade"]');

  const hasBackdrop = (el) =>
    [el, ...el.querySelectorAll("*")].some((node) => getComputedStyle(node).backdropFilter !== "none");

  const getTargets = (selector) =>
    [...wrap.querySelectorAll(selector)].flatMap((el) => {
      if (!hasBackdrop(el)) return [el];
      gsap.set(el, { autoAlpha: 1 });
      return [...el.children];
    });

  // Elements with their own backdrop-filter fade without a blur; everything else blurs in as before
  const blurFrom = (i, el) => (hasBackdrop(el) ? "none" : "blur(3px)");
  const blurTo = (i, el) => (hasBackdrop(el) ? "none" : "blur(0px)");

  const ups = getTargets('[data-load="fade-up"]');
  const lefts = getTargets('[data-load="fade-left"]');

  const tl = gsap.timeline({
    defaults: { ease: easeBase, duration: 1.4 },
  });

  if (heading) {
    if (typeof SplitText !== "undefined") {
      const split = new SplitText(headingEl, { type: "words" });
      gsap.set(heading, { autoAlpha: 1 });
      tl.fromTo(
        split.words,
        { x: "0.75em", autoAlpha: 0, filter: "blur(3px)" },
        { x: "0em", autoAlpha: 1, filter: "blur(0px)", stagger: 0.04, clearProps: "filter" },
        0.3
      );
    } else {
      tl.fromTo(heading, { autoAlpha: 0, x: "2rem" }, { autoAlpha: 1, x: "0rem" }, 0.3);
    }
  }

  if (ups.length) {
    tl.fromTo(
      ups,
      { autoAlpha: 0, y: "3rem", filter: blurFrom },
      { autoAlpha: 1, y: "0rem", filter: blurTo, stagger: 0.1, clearProps: "filter" },
      0.7
    );
  }

  if (lefts.length) {
    tl.fromTo(
      lefts,
      { autoAlpha: 0, x: "3rem", filter: blurFrom },
      { autoAlpha: 1, x: "0rem", filter: blurTo, stagger: 0.1, clearProps: "filter" },
      0.7
    );
  }

  if (fades.length) {
    tl.fromTo(
      fades,
      { autoAlpha: 0 },
      { autoAlpha: 1, stagger: 0.1 },
      0.9
    );
  }

  if (nav) {
    tl.to(nav, { y: "0%" }, 0.5);
  }
}

function disableScroll() {
  document.body.classList.add("no-scroll");
}

function enableScroll() {
  document.body.classList.remove("no-scroll");
}

function isMenuOpen() {
  const menu = document.querySelector(".nav_wrap");
  return menu && menu.getAttribute("aria-hidden") === "false";
}

function navScrim(show) {
  const scrim = document.querySelector('[data-menu="scrim"]');
  if (!scrim) return;

  gsap.killTweensOf(scrim);

  if (show) {
    scrim.style.visibility = "visible";
    scrim.style.pointerEvents = "auto";
  } else {
    scrim.style.pointerEvents = "none";
  }

  gsap.to(scrim, {
    "--scrim-blur": show ? "3px" : "0px",
    "--scrim-alpha": show ? 0.3 : 0,
    duration: show ? 0.4 : 0.3,
    ease: show ? "power2.out" : "power2.inOut",
    onComplete: () => {
      if (!show) scrim.style.visibility = "hidden";
    },
  });
}

function navDropdown() {
  const nav = document.querySelector('[data-menu="wrap"]');
  if (!nav) return;

  const items = [...nav.querySelectorAll('[data-dropdown="wrap"]')];
  if (!items.length) return;

  const ease = typeof easeBase !== "undefined" ? easeBase : "power3.out";
  const mm = gsap.matchMedia();

  mm.add("(min-width: 992px)", () => {
    const controller = new AbortController();
    const { signal } = controller;

    const scrim = document.querySelector('[data-menu="scrim"]');

    const OFFSET = 1.25; // rem the panel travels when opening from closed
    const COL_OFFSET = 0.5; // rem each column travels when opening from closed
    const SWITCH_OFFSET = 1.5; // rem columns travel when switching menus
    const BLUR = 4; // px blur at the start/end of the motion
    const CLOSE_DELAY = 150; // ms grace period after mouseleave
    const MIN_SPEED = 0.5; // px per event; slower = treated as vertical entry

    let active = null;
    let closeTimer = null;
    let lastX = null;
    let velocityX = 0;

    // --- Pointer direction ---------------------------------------------
    // Smoothed horizontal velocity so one jittery event can't flip direction.
    window.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        if (lastX !== null) velocityX = velocityX * 0.6 + (e.clientX - lastX) * 0.4;
        lastX = e.clientX;
      },
      { signal, passive: true }
    );

    // 1 = moving right, -1 = moving left, 0 = vertical / no movement
    const getDirection = () =>
      velocityX > MIN_SPEED ? 1 : velocityX < -MIN_SPEED ? -1 : 0;

    // --- Collect dropdowns (skip empty panels) -------------------------
    const dropdowns = items
      .map((item) => {
        const trigger = item.querySelector('[data-dropdown="trigger"]');
        const panel = item.querySelector(".dropdown_wrap");
        const layout = panel?.querySelector(".dropdown_layout");
        if (!trigger || !panel || !layout?.children.length) return null;
        return { item, trigger, panel, cols: panel.querySelectorAll(".dropdown_col") };
      })
      .filter(Boolean);

    dropdowns.forEach(({ trigger, panel }, i) => {
      if (!panel.id) panel.id = `nav-dropdown-${i}`;
      trigger.setAttribute("role", "button");
      trigger.setAttribute("tabindex", "0");
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-controls", panel.id);
      gsap.set(panel, { autoAlpha: 0 });
    });

    // --- Animation --------------------------------------------------------
    const animateCols = (d, dir, offset, blur, delay) => {
      if (!d.cols.length) return;
      gsap.fromTo(
        d.cols,
        { opacity: 0, x: `${-dir * offset}rem`, filter: `blur(${blur}px)` },
        {
          opacity: 1,
          x: "0rem",
          filter: "blur(0px)",
          duration: 0.45,
          ease,
          delay,
          stagger: { each: 0.05, from: dir === -1 ? "end" : "start" },
          onComplete: () => gsap.set(d.cols, { clearProps: "filter" }),
        }
      );
    };

    // Opening from fully closed: whole panel slides + blurs in, then columns
    const animateIn = (d, dir) => {
      gsap.killTweensOf([d.panel, ...d.cols]);
      gsap.set(d.panel, { zIndex: 2 });

      // Moving right (1) → enter from the left (negative x), and vice versa
      const isHidden = gsap.getProperty(d.panel, "opacity") < 0.01;

      const panelFrom = {
        autoAlpha: 0,
        x: `${-dir * OFFSET}rem`,
        y: dir === 0 ? "-0.25rem" : "0rem",
        filter: `blur(${BLUR}px)`,
      };
      const panelTo = {
        autoAlpha: 1,
        x: "0rem",
        y: "0rem",
        filter: "blur(0px)",
        duration: 0.45,
        ease,
        // Remove the filter when done — a lingering filter can soften text in Safari
        onComplete: () => gsap.set(d.panel, { clearProps: "filter" }),
      };

      // Only reset the start position if it's fully hidden — avoids a jump
      // when re-hovering a panel that's still fading out.
      isHidden ? gsap.fromTo(d.panel, panelFrom, panelTo) : gsap.to(d.panel, panelTo);
      animateCols(d, dir, COL_OFFSET, BLUR / 2, 0.04);
    };

    // Switching menus: card is already "open", so it appears instantly and
    // only the content slides in from the direction of travel.
    const animateSwitch = (d, dir) => {
      gsap.killTweensOf([d.panel, ...d.cols]);
      gsap.set(d.panel, { zIndex: 2, autoAlpha: 1, x: "0rem", y: "0rem", clearProps: "filter" });
      animateCols(d, dir, SWITCH_OFFSET, BLUR, 0);
    };

    // Closing to nothing: panel slides + blurs out in the direction of travel
    const animateOut = (d, dir) => {
      gsap.killTweensOf([d.panel, ...d.cols]);
      gsap.set(d.panel, { zIndex: 1 });
      gsap.to(d.panel, {
        autoAlpha: 0,
        x: `${dir * OFFSET}rem`,
        y: dir === 0 ? "-0.25rem" : "0rem",
        filter: `blur(${BLUR}px)`,
        duration: 0.22,
        ease: "power2.in",
      });
    };

    // Switching away: hide immediately so two panels never overlap
    const hideInstant = (d) => {
      gsap.killTweensOf([d.panel, ...d.cols]);
      gsap.set(d.panel, { autoAlpha: 0, zIndex: 1, clearProps: "filter" });
    };

    // --- Open / close -----------------------------------------------------
    const close = (d, dir = 0, switching = false) => {
      if (!d) return;
      d.item.classList.remove("is-open");
      d.trigger.setAttribute("aria-expanded", "false");
      switching ? hideInstant(d) : animateOut(d, dir);
      if (active === d) active = null;
      if (!switching) navScrim(false);
    };

    const open = (d, dir = getDirection()) => {
      clearTimeout(closeTimer);
      if (active === d) return;

      const switching = Boolean(active);
      if (switching) close(active, dir, true);

      active = d;
      d.item.classList.add("is-open");
      d.trigger.setAttribute("aria-expanded", "true");
      switching ? animateSwitch(d, dir) : animateIn(d, dir);
      if (!switching) navScrim(true);
    };

    const closeAll = () => {
      clearTimeout(closeTimer);
      if (active) close(active);
    };

    // --- Events -------------------------------------------------------------
    dropdowns.forEach((d) => {
      d.item.addEventListener("mouseenter", () => open(d), { signal });

      d.item.addEventListener(
        "mouseleave",
        () => {
          closeTimer = setTimeout(() => {
            if (active === d) close(d, getDirection());
          }, CLOSE_DELAY);
        },
        { signal }
      );

      // Mouse click: hover already opened it, so just make sure it's open
      d.trigger.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          open(d);
        },
        { signal }
      );

      // Keyboard: toggle, no directional slide
      d.trigger.addEventListener(
        "keydown",
        (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          active === d ? close(d) : open(d, 0);
        },
        { signal }
      );

      d.item.addEventListener(
        "focusout",
        (e) => {
          if (!d.item.contains(e.relatedTarget) && active === d) close(d);
        },
        { signal }
      );
    });

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Escape" || !active) return;
        const trigger = active.trigger;
        closeAll();
        trigger.focus();
      },
      { signal }
    );

    document.addEventListener(
      "click",
      (e) => {
        if (!nav.contains(e.target)) closeAll();
      },
      { signal }
    );

    if (scrim) scrim.addEventListener("click", closeAll, { signal });

    // Lets other scripts close panels
    nav._closeDropdowns = closeAll;

    return () => {
      controller.abort();
      clearTimeout(closeTimer);
      dropdowns.forEach((d) => {
        // Hover/close tweens aren't reverted by matchMedia — clear them manually
        gsap.killTweensOf([d.panel, ...d.cols]);
        gsap.set([d.panel, ...d.cols], { clearProps: "all" });
        d.item.classList.remove("is-open");
        d.trigger.setAttribute("aria-expanded", "false");
      });
      if (active) navScrim(false);
      delete nav._closeDropdowns;
    };
  });
}

function linesDots() {
  const wraps = document.querySelectorAll('[data-lines="wrap"]');
  if (!wraps.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const svgNS = "http://www.w3.org/2000/svg";
  const SPEED = 260;              // average screen px per second at desktop widths (same feel on every path)
  const SPEED_REF_WIDTH = 1280;   // viewport width SPEED is tuned for; narrower screens move proportionally slower
  const SPEED_MIN_SCALE = 0.45;   // floor for that slowdown (390px phone ≈ 0.45 × SPEED ≈ 117px/s)
  const MIN_DURATION = 1.2;       // seconds, so short paths don't zip
  const DOT_RADIUS = 3;           // screen px (compensated for SVG scaling)
  const STAGGER = [0.15, 0.5];    // seconds between dots within a round (random, so every round differs a little)
  const ROUND_GAP = [0.4, 1];     // seconds after the last dot of a round lands before the next round (random)
  const FADE = 0.08;              // fade in/out over the first/last 8% of the path
  const EASE = "power3.inOut";

  // A fixed px/s feels much faster on a phone, where a dot crosses the whole screen in a second or two,
  // so speed scales with viewport width (read at launch time, so it follows resizes/rotation)
  const getSpeed = () =>
    SPEED * gsap.utils.clamp(SPEED_MIN_SCALE, 1, window.innerWidth / SPEED_REF_WIDTH);

  wraps.forEach((wrap) => {
    if (wrap.dataset.linesInitialized) return;
    wrap.dataset.linesInitialized = "true";

    const svg = wrap.querySelector("svg");
    const paths = svg ? [...svg.querySelectorAll("path")] : [];
    if (!paths.length) return;

    const group = document.createElementNS(svgNS, "g");
    group.setAttribute("class", "lines_dots");
    svg.appendChild(group);

    let active = false;
    let round = null;   // timeline holding the current round of dots
    let next = null;    // delayed call that starts the next round

    // Instances whose paths are drawn in by their own script (data-lines-connect) wait for it
    let ready = !wrap.hasAttribute("data-lines-connect") || wrap.dataset.linesReady === "true";
    wrap.addEventListener("lines:ready", () => {
      ready = true;
    });

    const isRendered = () => svg.getBoundingClientRect().width > 0;
    const getScale = () => svg.getScreenCTM()?.a || 1;

    // One dot travelling one path. Path is read live every frame, so dots follow paths
    // that get recalculated on resize.
    const dotTween = (path) => {
      const scale = getScale();
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "lines_dot");
      dot.setAttribute("r", DOT_RADIUS / scale);
      dot.style.opacity = 0;

      const state = { progress: 0 };

      return gsap.to(state, {
        progress: 1,
        duration: Math.max(MIN_DURATION, (path.getTotalLength() * scale) / getSpeed()),
        ease: EASE,
        onStart: () => group.appendChild(dot),
        onUpdate: () => {
          const pt = path.getPointAtLength(state.progress * path.getTotalLength());
          dot.setAttribute("cx", pt.x);
          dot.setAttribute("cy", pt.y);
          dot.style.opacity = Math.min(1, state.progress / FADE, (1 - state.progress) / FADE);
        },
        onComplete: () => dot.remove()
      });
    };

    // A round sends one dot down every path, a beat apart in a random order, each at its own natural speed.
    // The next round waits until the whole group has landed, so the dots always travel as a loose cluster.
    const runRound = () => {
      if (!active) return;

      const live = paths.filter((p) => p.getTotalLength() > 0);

      // Not ready yet (lines still drawing) or hidden at this breakpoint: check again shortly
      if (!ready || !isRendered() || !live.length) {
        next = gsap.delayedCall(0.2, runRound);
        return;
      }

      round = gsap.timeline({
        onComplete: () => {
          round = null;
          next = gsap.delayedCall(gsap.utils.random(...ROUND_GAP), runRound);
        }
      });

      let at = 0;
      gsap.utils.shuffle(live).forEach((path) => {
        round.add(dotTween(path), at);
        at += gsap.utils.random(...STAGGER);
      });
    };

    const start = () => {
      active = true;
      if (round) round.resume();
      else if (next && next.progress() < 1) next.resume();
      else next = gsap.delayedCall(gsap.utils.random(0, 0.4), runRound);
    };

    const stop = () => {
      active = false;
      round?.pause();
      next?.pause();
    };

    // Only animate while the instance is on screen
    ScrollTrigger.create({
      trigger: wrap,
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => (self.isActive ? start() : stop())
    });
  });
}

function initAccordions(scope = document) {
  if (typeof gsap === "undefined") return;

  // Counter lives on the function so IDs stay unique across repeat calls
  initAccordions.uid = initAccordions.uid || 0;

  const LIST = '[data-accordion="list"]';
  const WRAP = '[data-accordion="wrap"]';

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DURATION = reduceMotion ? 0 : 0.5;
  const EASE = window.easeBase || "power2.inOut";
  const ICON_OPEN = 135;

  const refreshScroll = () => {
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  };

  // Nearest list or wrap above an element: tells us which accordion it belongs to
  const parentGroup = (el) => el.parentElement && el.parentElement.closest(`${LIST}, ${WRAP}`);

  const open = (item) => {
    const { wrap, trigger, content, icon } = item;
    wrap.dataset.state = "open";
    trigger.setAttribute("aria-expanded", "true");

    gsap.set(content, { display: "block" });
    gsap.to(content, {
      height: "auto",
      duration: DURATION,
      ease: EASE,
      overwrite: true, // kills an in-progress close (and its display:none onComplete)
      onComplete: refreshScroll,
    });
    if (icon) gsap.to(icon, { rotate: ICON_OPEN, duration: DURATION, ease: EASE, overwrite: true });
  };

  const close = (item) => {
    const { wrap, trigger, content, icon } = item;
    wrap.dataset.state = "closed";
    trigger.setAttribute("aria-expanded", "false");

    gsap.to(content, {
      height: 0,
      duration: DURATION,
      ease: EASE,
      overwrite: true,
      onComplete: () => {
        gsap.set(content, { display: "none" });
        refreshScroll();
      },
    });
    if (icon) gsap.to(icon, { rotate: 0, duration: DURATION, ease: EASE, overwrite: true });
  };

  const buildItem = (wrap) => {
    const find = (name) =>
      [...wrap.querySelectorAll(`[data-accordion="${name}"]`)].find(
        (el) => el.closest(WRAP) === wrap
      );
    const trigger = find("trigger");
    const content = find("content");
    const icon = find("icon") || (trigger && trigger.querySelector("svg"));
    return { wrap, trigger, content, icon };
  };

  const setupItems = (items, defaultState, allowMultiple) => {
    items.forEach((item, i) => {
      const { wrap, trigger, content, icon } = item;
      const id = ++initAccordions.uid;

      // Accessibility wiring
      trigger.id = trigger.id || `accordion-trigger-${id}`;
      content.id = content.id || `accordion-content-${id}`;
      trigger.setAttribute("type", "button");
      trigger.setAttribute("aria-controls", content.id);
      content.setAttribute("role", "region");
      content.setAttribute("aria-labelledby", trigger.id);

      // Initial state
      const isOpen = defaultState === "all" || (defaultState === "first" && i === 0);
      wrap.dataset.state = isOpen ? "open" : "closed";
      trigger.setAttribute("aria-expanded", String(isOpen));
      gsap.set(content, {
        overflow: "hidden",
        height: isOpen ? "auto" : 0,
        display: isOpen ? "block" : "none",
      });
      if (icon) gsap.set(icon, { rotate: isOpen ? ICON_OPEN : 0 });

      trigger.addEventListener("click", () => {
        const wasOpen = wrap.dataset.state === "open";

        if (!allowMultiple) {
          items.forEach((other) => {
            if (other !== item && other.wrap.dataset.state === "open") close(other);
          });
        }

        wasOpen ? close(item) : open(item);
      });
    });
  };

  // Lists
  scope.querySelectorAll(LIST).forEach((list) => {
    if (list.dataset.accordionInit) return;
    list.dataset.accordionInit = "true";

    const items = [...list.querySelectorAll(WRAP)]
      .filter((wrap) => parentGroup(wrap) === list)
      .map(buildItem)
      .filter((item) => item.trigger && item.content);

    setupItems(
      items,
      list.dataset.accordionDefault || "first",
      list.dataset.accordionMultiple === "true"
    );
  });

  // Standalone items: any wrap not directly inside a list. Closed by default.
  scope.querySelectorAll(WRAP).forEach((wrap) => {
    if (wrap.dataset.accordionInit) return;
    const group = parentGroup(wrap);
    if (group && group.matches(LIST)) return;
    wrap.dataset.accordionInit = "true";

    const item = buildItem(wrap);
    if (!item.trigger || !item.content) return;

    setupItems([item], wrap.dataset.accordionDefault === "open" ? "all" : "none", true);
  });
}

function headingSplit() {
  const wraps = gsap.utils.toArray('[data-scroll="heading"]');
  if (!wraps.length) return;

  wraps.forEach((wrap) => {
    const heading = wrap.querySelector("h1, h2, h3") || wrap;

    // Reveal the element the CSS actually hides
    gsap.set(wrap, { autoAlpha: 1 });

    if (typeof SplitText === "undefined") return;

    const split = new SplitText(heading, { type: "words" });

    gsap.set(split.words, {
      autoAlpha: 0,
      x: "0.75em",
      filter: "blur(3px)",
    });

    gsap.timeline({
      scrollTrigger: {
        trigger: wrap,
        start: "top 85%",
        toggleActions: "play none none none",
      },
      defaults: { ease: easeBase, duration: 1.2 },
    }).to(split.words, {
      autoAlpha: 1,
      x: "0em",
      filter: "blur(0px)",
      stagger: 0.04,
    });
  });
}

function fadeUp() {
  const items = gsap.utils.toArray('[data-scroll="fade-up"]');
  if (!items.length) return;

  gsap.set(items, { y: "3rem" });

  items.forEach((item) => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: item,
        start: "top 80%",
        toggleActions: "play none none none",
      },
      defaults: { ease: easeBase, duration: 1.4 },
      onComplete: () =>
        gsap.set(item, { clearProps: "filter,transform,willChange" }),
    });

    tl.to(item, { autoAlpha: 1, y: "0rem", filter: "blur(0px)" });
  });
}

function fadeLeft() {
  const items = gsap.utils.toArray('[data-scroll="fade-left"]');
  if (!items.length) return;

  gsap.set(items, { x: "3rem" });

  items.forEach((item) => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: item,
        start: "top 80%",
        toggleActions: "play none none none",
      },
      defaults: { ease: easeBase, duration: 1.4 },
      onComplete: () =>
        gsap.set(item, { clearProps: "filter,transform,willChange" }),
    });

    tl.to(item, { autoAlpha: 1, x: "0rem", filter: "blur(0px)" });
  });
}

function parallaxStagger() {
  const wraps = document.querySelectorAll('[data-parallax-stagger="wrap"]');
  if (!wraps.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.set('[data-parallax-stagger="item"]', { opacity: 1, y: 0, filter: "blur(0rem)" });
    return;
  }

  wraps.forEach((wrap) => {
    // Only this wrap's items (skips items that belong to a nested wrap)
    const items = [...wrap.querySelectorAll('[data-parallax-stagger="item"]')].filter(
      (item) => item.closest('[data-parallax-stagger="wrap"]') === wrap
    );
    if (!items.length) return;

    gsap.fromTo(
      items,
      { opacity: 0, y: "2rem", filter: "blur(4px)" },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 1,
        ease: "none",
        stagger: { each: 0.3, from: "random" },
        scrollTrigger: {
          trigger: wrap,
          start: "top 95%",
          end: "top 50%",
          scrub: 0.6
        }
      }
    );
  });
}

function velocitySkew() {
  const nodes = document.querySelectorAll("[data-skew]");
  if (!nodes.length) return;
 
  const FRAME = 1000 / 60;
  const JUMP = 200; // px in one frame = a marquee wrap, not real motion
 
  // Works whether Lenis is a top-level const or attached to window,
  // and doesn't throw if Lenis isn't on the page at all.
  const getLenis = () =>
    typeof lenis !== "undefined" ? lenis : window.lenis || null;
 
  const targets = [];
  let frame = null;
 
  const readX = (el) => {
    const match = /translate(?:3d|X)?\((-?[\d.]+)px/.exec(el.style.transform);
    if (match) return parseFloat(match[1]);
    return new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
  };
 
  const render = (now) => {
    let active = false;
    const l = getLenis();
    const scrollV = l ? l.velocity : 0;
 
    for (const t of targets) {
      if (!t.visible) continue;
      active = true;
 
      const dt = Math.max(now - t.last, 1);
      t.last = now;
 
      let perFrame = 0;
      let extra = 0;
 
      if (t.source === "scroll") {
        perFrame = scrollV;
      } else {
        const pos = readX(t.el);
        const delta = pos - t.prev;
        t.prev = pos;
        // A looping marquee jumps a full set width once per cycle. Anything
        // that big in one frame is the wrap, so skip it rather than snapping.
        if (Math.abs(delta) < JUMP) perFrame = delta * (FRAME / dt);
 
        // Scroll velocity as extra energy on top of the track's own motion.
        // Not subject to baseline — the baseline is for resting speed only.
        if (t.scroll) extra = Math.abs(scrollV) * t.scroll;
      }
 
      // Lean in the direction of travel. A stationary track falls back to
      // the scroll direction.
      const dir = Math.sign(perFrame) || -Math.sign(scrollV);
 
      // Deviation from resting speed, so a cruising marquee sits at zero.
      const dev = Math.max(Math.abs(perFrame) - t.baseline, 0) + extra;
      const norm = Math.min(dev / t.ref, 1);
      const goal = Math.pow(norm, t.curve) * t.max * (dir > 0 ? -1 : 1);
 
      t.skew += (goal - t.skew) * (1 - Math.pow(1 - t.ease, dt / FRAME));
 
      if (Math.abs(t.skew) < 0.01 && dev < 0.1) {
        // Write zero once on settling, then stop touching the DOM.
        if (!t.settled) {
          t.node.style.setProperty("--skew", "0deg");
          t.settled = true;
        }
      } else {
        t.node.style.setProperty("--skew", t.skew.toFixed(2) + "deg");
        t.settled = false;
      }
    }
 
    frame = active ? requestAnimationFrame(render) : null;
  };
 
  const start = () => {
    if (frame !== null) return;
    const now = performance.now();
    targets.forEach((t) => {
      t.last = now;
      if (t.el) t.prev = readX(t.el);
    });
    frame = requestAnimationFrame(render);
  };
 
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const t = targets.find((x) => x.node === entry.target);
        if (!t) return;
        t.visible = entry.isIntersecting;
        // Position moved while we weren't watching; don't read that as speed.
        if (t.visible && t.el) t.prev = readX(t.el);
      });
      if (targets.some((t) => t.visible)) start();
    },
    { threshold: 0 }
  );
 
  nodes.forEach((node) => {
    if (node.dataset.skewInitialized) return;
    node.dataset.skewInitialized = "true";
 
    const source = node.dataset.skew === "scroll" ? "scroll" : "track";
    let el = null;
 
    if (source === "track") {
      const selector = node.dataset.skewEl;
      el = selector
        ? node.querySelector(selector)
        : node.querySelector(".swiper-wrapper") || node.firstElementChild;
      if (!el) return;
    }
 
    targets.push({
      node,
      el,
      source,
      max: parseFloat(node.dataset.skewMax) || 2.5,
      ref: parseFloat(node.dataset.skewRef) || 45,
      curve: parseFloat(node.dataset.skewCurve) || 0.75,
      ease: parseFloat(node.dataset.skewEase) || 0.2,
      baseline: parseFloat(node.dataset.skewBaseline) || 0,
      scroll: parseFloat(node.dataset.skewScroll) || 0,
      skew: 0,
      prev: el ? readX(el) : 0,
      last: performance.now(),
      visible: false,
      settled: true,
    });
 
    observer.observe(node);
  });
 
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") return;
    if (targets.some((t) => t.visible)) start();
  });
}

function copyright() {
  const copyrightDate = document.querySelector(
    '[data-element="copyright-date"]'
  );

  if (copyrightDate) {
    const currentYear = new Date().getFullYear();
    copyrightDate.textContent = currentYear;
  }
}

function hubspotForms() {
  const PORTAL_ID = "48226768";
  const SKIP = /^(cf-turnstile-response|g-recaptcha-response|h-captcha-response)$/;

  document.querySelectorAll("form[data-hs-form]").forEach((component) => {
    if (component.dataset.scriptInitialized) return;
    component.dataset.scriptInitialized = "true";

    const endpoint = `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${component.dataset.hsForm}`;

    component.addEventListener("submit", () => {
      // No Turnstile token = Webflow rejects it too, so skip HubSpot.
      const turnstile = component.querySelector('[name="cf-turnstile-response"]');
      if (turnstile && !turnstile.value) return;

      const fields = [];
      component.querySelectorAll("input, select, textarea").forEach((field) => {
        const name = field.dataset.hsField || field.id;
        if (!name || SKIP.test(field.name) || /^(submit|hidden|button)$/.test(field.type)) return;
        if ((field.type === "checkbox" || field.type === "radio") && !field.checked) return;
        const v = field.value.trim();
        if (v) fields.push({ objectTypeId: "0-1", name, value: v });
      });

      // Save name/email/practice so the scheduler on /thank-you can prefill them.
      // Only for forms that collect a first name, so the newsletter form
      // doesn't overwrite a demo prefill with an email-only record.
      const get = (id) => fields.find((f) => f.name === id)?.value || "";
      if (get("firstname")) {
        try {
          sessionStorage.setItem("hs-prefill", JSON.stringify({
            firstName: get("firstname"), lastName: get("lastname"), email: get("email"),
            company: get("what_is_the_name_of_your_practice"),
          }));
        } catch (e) {}
      }

      const context = { pageUri: window.location.href, pageName: document.title };
      const hutk = document.cookie.match(/(?:^|; )hubspotutk=([^;]*)/);
      if (hutk) context.hutk = decodeURIComponent(hutk[1]);

      // keepalive lets the request finish through Webflow's redirect.
      fetch(endpoint, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, context }),
      })
        .then(async (res) => {
          if (!res.ok) console.error("[hubspot-form]", res.status, await res.text());
        })
        .catch((err) => console.error("[hubspot-form]", err));
    });
  });
}

// MOBILE MENU

function mobileMenu() {
  const nav = document.querySelector('[data-menu="wrap"]');
  if (!nav) return;

  const menu = nav.querySelector(".nav_content");
  const button = nav.querySelector('[data-menu="hamburger"], .nav_button');
  if (!menu || !button) return;

  const ease = typeof easeBase !== "undefined" ? easeBase : "power3.out";
  const lockScroll = () => typeof disableScroll === "function" && disableScroll();
  const unlockScroll = () => typeof enableScroll === "function" && enableScroll();
  const mm = gsap.matchMedia();

  mm.add("(max-width: 991px)", () => {
    const controller = new AbortController();
    const { signal } = controller;

    const [lineTop, lineBottom] = button.children;
    const items = menu.querySelectorAll('.nav_menu > [data-menu="item"], .nav_buttons > *');
    const scrim = document.querySelector('[data-menu="scrim"]');

    const LINE_SHIFT = 5; // px — half the distance between the two lines
    const ITEM_START = { opacity: 0, y: "0.75rem", filter: "blur(1px)" };

    let isOpen = false;
    let tl = null;

    // --- Setup ------------------------------------------------------------
    if (!menu.id) menu.id = "nav-mobile-menu";
    button.setAttribute("aria-controls", menu.id);
    button.setAttribute("aria-expanded", "false");

    gsap.set(menu, { display: "none", height: 0, overflowY: "hidden" });
    gsap.set(items, ITEM_START);

    // --- Accordions (Who We Serve / Resources) ----------------------------
    const accordions = [...menu.querySelectorAll('[data-dropdown="wrap"]')]
      .map((item, i) => {
        const trigger = item.querySelector('[data-dropdown="trigger"]');
        const panel = item.querySelector(".dropdown_wrap");
        if (!trigger || !panel) return null;

        if (!panel.id) panel.id = `nav-dropdown-${i}`;
        trigger.setAttribute("role", "button");
        trigger.setAttribute("tabindex", "0");
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-controls", panel.id);
        gsap.set(panel, { height: 0 });

        return { item, trigger, panel, isOpen: false };
      })
      .filter(Boolean);

    const setAccordion = (a, open, instant = false) => {
      a.isOpen = open;
      a.item.classList.toggle("is-open", open);
      a.trigger.setAttribute("aria-expanded", String(open));
      gsap.killTweensOf(a.panel);

      if (instant) {
        gsap.set(a.panel, { height: open ? "auto" : 0 });
        return;
      }

      gsap.to(a.panel, {
        height: open ? "auto" : 0,
        duration: open ? 0.45 : 0.35,
        ease: "power3.inOut",
      });
    };

    const toggleAccordion = (a) => {
      const next = !a.isOpen;
      accordions.forEach((other) => other !== a && other.isOpen && setAccordion(other, false));
      setAccordion(a, next);
    };

    const collapseAccordions = () => {
      accordions.forEach((a) => a.isOpen && setAccordion(a, false, true));
    };

    accordions.forEach((a) => {
      a.trigger.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          toggleAccordion(a);
        },
        { signal }
      );

      a.trigger.addEventListener(
        "keydown",
        (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          toggleAccordion(a);
        },
        { signal }
      );
    });

    // --- Open -------------------------------------------------------------
    const openMenu = () => {
      if (isOpen) return;
      isOpen = true;
      tl?.kill();

      nav.classList.add("is-menu-open");
      button.setAttribute("aria-expanded", "true");
      button.setAttribute("aria-label", "Close menu");
      lockScroll();
      navScrim(true);

      tl = gsap.timeline({ defaults: { ease } });
      tl.set(menu, { display: "block", overflowY: "hidden" })
        // Hamburger: lines meet, then rotate into an X
        .to(lineTop, { y: LINE_SHIFT, duration: 0.18, ease: "power2.in" }, 0)
        .to(lineBottom, { y: -LINE_SHIFT, duration: 0.18, ease: "power2.in" }, 0)
        .to(lineTop, { rotate: 45, duration: 0.3, ease: "power3.out" }, 0.18)
        .to(lineBottom, { rotate: -45, duration: 0.3, ease: "power3.out" }, 0.18)
        // Drawer grows straight down — height only, nothing else scales
        .to(
          menu,
          {
            height: "auto",
            duration: 0.55,
            ease: "power4.out",
            // Allow scrolling only once fully open (long menu on short screens)
            onComplete: () => gsap.set(menu, { overflowY: "auto" }),
          },
          0
        )
        // Items rise, sharpen, and fade in
        .to(
          items,
          { y: "0rem", opacity: 1, filter: "blur(0px)", duration: 0.6, stagger: 0.08 },
          0.12
        );
    };

    // --- Close ------------------------------------------------------------
    const closeMenu = ({ returnFocus = false } = {}) => {
      if (!isOpen) return;
      isOpen = false;
      tl?.kill();

      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Open menu");
      navScrim(false);

      tl = gsap.timeline({
        onComplete: () => {
          gsap.set(menu, { display: "none" });
          gsap.set(items, ITEM_START); // reset position AND blur for next open
          collapseAccordions();
          nav.classList.remove("is-menu-open");
          unlockScroll();
        },
      });

      tl.set(menu, { overflowY: "hidden" })
        .to(items, { opacity: 0, duration: 0.15, ease: "power1.out" }, 0)
        .to(menu, { height: 0, duration: 0.4, ease: "power3.inOut" }, 0.05)
        // Hamburger: unrotate, then separate
        .to([lineTop, lineBottom], { rotate: 0, duration: 0.22, ease: "power2.in" }, 0)
        .to([lineTop, lineBottom], { y: 0, duration: 0.22, ease: "power2.out" }, 0.22);

      if (returnFocus) button.focus();
    };

    // --- Events -----------------------------------------------------------
    button.addEventListener("click", () => (isOpen ? closeMenu() : openMenu()), { signal });

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && isOpen) closeMenu({ returnFocus: true });
      },
      { signal }
    );

    document.addEventListener(
      "click",
      (e) => {
        if (isOpen && !nav.contains(e.target)) closeMenu();
      },
      { signal }
    );

    // Close when a link is followed (matters for same-page anchors)
    menu.addEventListener(
      "click",
      (e) => {
        if (e.target.closest("a")) closeMenu();
      },
      { signal }
    );

    if (scrim) scrim.addEventListener("click", () => closeMenu(), { signal });

    // --- Cleanup when crossing to desktop ---------------------------------
    // matchMedia reverts every gsap.set/tween made above (display, height,
    // overflow, line transforms), so only non-GSAP state needs resetting here.
    return () => {
      controller.abort();
      tl?.kill();
    
      // Open/close/accordion tweens aren't reverted by matchMedia — clear them manually
      const panels = accordions.map((a) => a.panel);
      gsap.killTweensOf([menu, ...items, lineTop, lineBottom, ...panels]);
      gsap.set([menu, ...items, lineTop, lineBottom, ...panels], { clearProps: "all" });
    
      if (isOpen) {
        unlockScroll();
        navScrim(false);
      }
      nav.classList.remove("is-menu-open");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Open menu");
      accordions.forEach((a) => {
        a.item.classList.remove("is-open");
        a.trigger.setAttribute("aria-expanded", "false");
      });
    };
  });
}

document.addEventListener("DOMContentLoaded", function () {
  lenisScroll();
  loader();
  navDropdown();
  linesDots();
  initAccordions();
  headingSplit();
  fadeUp();
  fadeLeft();
  parallaxStagger();
  velocitySkew();
  copyright();
  hubspotForms();

  gsap.matchMedia().add("(max-width: 991px)", () => {
    mobileMenu();
  });
});