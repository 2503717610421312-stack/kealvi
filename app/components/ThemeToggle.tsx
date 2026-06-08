"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "liveqa_theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const nextTheme = saved === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem(STORAGE_KEY, nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-full border bg-surface px-4 py-2 text-sm transition hover:border-brand hover:bg-brand-soft"
    >
      {theme === "dark" ? "Switch to light" : "Switch to dark"}
    </button>
  );
}
