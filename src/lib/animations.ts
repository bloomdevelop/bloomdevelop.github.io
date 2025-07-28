import type { TransitionAnimation } from "astro";

const animation = {
  old: {
    name: "scale-out",
    duration: "0.2s",
    easing: "cubic-bezier(0.190, 1.000, 0.220, 1.000)",
  },
  new: {
    name: "scale-in",
    duration: "0.8s",
    easing: "cubic-bezier(0.165, 0.840, 0.440, 1.000)",
  },
};

const customTransition = {
  forwards: animation,
  backwards: animation,
};

export {customTransition}