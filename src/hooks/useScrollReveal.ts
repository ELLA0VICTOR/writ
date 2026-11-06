import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export function useScrollReveal() {
  const { pathname, search } = useLocation();
  useLayoutEffect(() => {
    const root = document.getElementById("main");
    if (!root || !("IntersectionObserver" in window)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = new Set<HTMLElement>();
    let order = 0;
    const show = (element: HTMLElement) => {
      element.dataset.revealState = "shown";
      observer.unobserve(element);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) show(entry.target as HTMLElement);
      },
      { threshold: 0.04, rootMargin: "0px 0px -24px 0px" },
    );
    function discover() {
      for (const element of root!.querySelectorAll<HTMLElement>(
        "[data-reveal]",
      )) {
        if (elements.has(element)) continue;
        elements.add(element);
        if (preference.matches) continue;
        element.style.setProperty(
          "--reveal-delay",
          `${60 + (order++ % 3) * 60}ms`,
        );
        element.dataset.revealState = "pending";
        observer.observe(element);
      }
    }
    const revealFocused = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      const element = event.target.closest<HTMLElement>("[data-reveal]");
      if (element) show(element);
    };
    const reduceMotion = () => {
      if (preference.matches) for (const element of elements) show(element);
    };
    discover();
    const mutations = new MutationObserver(discover);
    mutations.observe(root, { childList: true, subtree: true });
    root.addEventListener("focusin", revealFocused);
    preference.addEventListener("change", reduceMotion);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      root.removeEventListener("focusin", revealFocused);
      preference.removeEventListener("change", reduceMotion);
      for (const element of elements) {
        delete element.dataset.revealState;
        element.style.removeProperty("--reveal-delay");
      }
    };
  }, [pathname, search]);
}
