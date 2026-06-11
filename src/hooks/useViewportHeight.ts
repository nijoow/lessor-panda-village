"use client";

import { useEffect } from "react";

/** 모바일 브라우저 상/하단바로 인한 100vh 오차를 --vh CSS 변수로 보정 */
export const useViewportHeight = () => {
  useEffect(() => {
    const updateVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };

    updateVh();
    window.addEventListener("resize", updateVh);
    return () => window.removeEventListener("resize", updateVh);
  }, []);
};
