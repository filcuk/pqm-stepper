/** Fork-sensitive defaults — edit when creating your app from this template. */
export const APP_CONFIG = {
  /** Public site URL (GitHub Pages / custom domain). Used to hide this app in “also see”. */
  appUrl: "https://filcuk.github.io/pqm-stepper/",
  repoUrl: "https://github.com/filcuk/pqm-stepper",
  themeStorageKey: "pqm-theme",
  themeChangeEvent: "pqm-theme-change",
  /**
   * Remote JSON for the footer “also see” menu.
   * Top-level array of `{ topic, items, order? }` sections and/or flat link objects.
   * Optional `order` on topics/links; `accent` / `accentHover` hex colours for
   * per-app menu highlighting; `iconSvg` / `iconSvgLight` / `iconSvgDark` for
   * embedded SVG (wins over URL icons). Prefer a raw.githubusercontent.com or
   * GitHub Pages URL. Empty = skip fetch. On success, shows the remote list
   * (merged with local when `alsoSeeIncludeLocal` is true). Local is never used
   * as a fallback.
   */
  alsoSeeUrl:
    "https://raw.githubusercontent.com/filcuk/shared/refs/heads/main/apps/links.json",
  /**
   * Topic filter for the **remote** also-see list (`"*"`, `""`, `"Topic"`,
   * `"-Topic"`). Local `alsoSee` is not filtered when `alsoSeeIncludeLocal`
   * is true.
   */
  alsoSeeTopics: ["*"],
  /**
   * When true, include local `alsoSee` in full (alone if there is no remote, or
   * merged with the filtered remote — same topic names share one section; items
   * de-duplicated by URL). When false, local is never shown.
   */
  alsoSeeIncludeLocal: true,
  alsoSee: [],
};
