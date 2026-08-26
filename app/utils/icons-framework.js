/**
 * Framework-owned inline SVG icons. Synced / hashed with the framework — do not
 * add fork-specific artwork here. Forks add icons in `icons-app.js`.
 *
 * Match `viewBox` to the source SVG (Material Icons from Icônes use `0 0 24 24`).
 * For third-party icons, set `name` to the collection id (e.g. `round-info`).
 * To reuse an existing framework icon under another id, set `ref` to the target key.
 *
 * Available: light-mode, dark-mode, auto-mode, lines, info, success, note, warning, error, important, help, experiment, format-quote, tip, chevron-up, chevron-down, chevron-right, chevron-left, arrow-outward, link, fullscreen, fullscreen-exit, upload, download, calendar, clock, check, minus, plus, delete, remove, type-text, type-number, type-logical, copy, paste, paste-special, clear, highlight, palette
 */

/** @typedef {{ viewBox: string, markup: string, attribution?: string, name?: string }} IconSvgDef */
/** @typedef {{ ref: string }} IconRefDef */
/** @typedef {IconSvgDef | IconRefDef} IconDef */

/** Reusable attribution strings for licensed icon sets. */
export const ICON_ATTRIBUTIONS = {
  materialIcons:
    "Icon from Google Material Icons by Material Design Authors - https://github.com/material-icons/material-icons/blob/master/LICENSE",
  materialSymbols:
    "Icon from Material Symbols by Google - https://github.com/google/material-design-icons/blob/master/LICENSE",
};

/** @type {Record<string, IconDef>} */
export const FRAMEWORK_ICONS = {
  "light-mode": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5s5-2.24 5-5s-2.24-5-5-5M2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1m18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1M11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1m0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1M5.99 4.58a.996.996 0 0 0-1.41 0a.996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41zm12.37 12.37a.996.996 0 0 0-1.41 0a.996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41zm1.06-10.96a.996.996 0 0 0 0-1.41a.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0zM7.05 18.36a.996.996 0 0 0 0-1.41a.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-light-mode",
  },
  "dark-mode": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M11.57 2.3c2.38-.59 4.68-.27 6.63.64c.35.16.41.64.1.86C15.7 5.6 14 8.6 14 12s1.7 6.4 4.3 8.2c.32.22.26.7-.09.86c-1.28.6-2.71.94-4.21.94c-6.05 0-10.85-5.38-9.87-11.6c.61-3.92 3.59-7.16 7.44-8.1"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-nightlight",
  },
  "auto-mode": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2S2 6.48 2 12s4.48 10 10 10m1-17.93c3.94.49 7 3.85 7 7.93s-3.05 7.44-7 7.93z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-contrast",
  },
  lines: { ref: "note" },
  info: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m0 15c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1s1 .45 1 1v4c0 .55-.45 1-1 1m1-8h-2V7h2z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-info",
  },
  success: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2M9.29 16.29L5.7 12.7a.996.996 0 1 1 1.41-1.41L10 14.17l6.88-6.88a.996.996 0 1 1 1.41 1.41l-7.59 7.59a.996.996 0 0 1-1.41 0"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-check-circle",
  },
  note: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M20 11H4c-.55 0-1 .45-1 1s.45 1 1 1h16c.55 0 1-.45 1-1s-.45-1-1-1M4 18h10c.55 0 1-.45 1-1s-.45-1-1-1H4c-.55 0-1 .45-1 1s.45 1 1 1M20 6H4c-.55 0-1 .45-1 1v.01c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V7c0-.55-.45-1-1-1"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-notes",
  },
  important: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="m12 17.27l4.15 2.51c.76.46 1.69-.22 1.49-1.08l-1.1-4.72l3.67-3.18c.67-.58.31-1.68-.57-1.75l-4.83-.41l-1.89-4.46c-.34-.81-1.5-.81-1.84 0L9.19 8.63l-4.83.41c-.88.07-1.24 1.17-.57 1.75l3.67 3.18l-1.1 4.72c-.2.86.73 1.54 1.49 1.08z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-star",
  },
  warning: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M4.47 21h15.06c1.54 0 2.5-1.67 1.73-3L13.73 4.99c-.77-1.33-2.69-1.33-3.46 0L2.74 18c-.77 1.33.19 3 1.73 3M12 14c-.55 0-1-.45-1-1v-2c0-.55.45-1 1-1s1 .45 1 1v2c0 .55-.45 1-1 1m1 4h-2v-2h2z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-warning",
  },
  error: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10s10-4.47 10-10S17.53 2 12 2m4.3 14.3a.996.996 0 0 1-1.41 0L12 13.41L9.11 16.3a.996.996 0 1 1-1.41-1.41L10.59 12L7.7 9.11A.996.996 0 1 1 9.11 7.7L12 10.59l2.89-2.89a.996.996 0 1 1 1.41 1.41L13.41 12l2.89 2.89c.38.38.38 1.02 0 1.41"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-cancel",
  },
  help: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m1 17h-2v-2h2zm2.07-7.75l-.9.92c-.5.51-.86.97-1.04 1.69c-.08.32-.13.68-.13 1.14h-2v-.5a4 4 0 0 1 1.17-2.83l1.24-1.26c.46-.44.68-1.1.55-1.8a1.99 1.99 0 0 0-1.39-1.53c-1.11-.31-2.14.32-2.47 1.27c-.12.37-.43.65-.82.65h-.3C8.4 9 8 8.44 8.16 7.88a4.01 4.01 0 0 1 3.23-2.83c1.52-.24 2.97.55 3.87 1.8c1.18 1.63.83 3.38-.19 4.4"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-help",
  },
  experiment: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M5 21q-1.275 0-1.812-1.137t.262-2.113L9 11V5H8q-.425 0-.712-.288T7 4t.288-.712T8 3h8q.425 0 .713.288T17 4t-.288.713T16 5h-1v6l5.55 6.75q.8.975.263 2.113T19 21zm2-3h10l-3.4-4h-3.2z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialSymbols,
    name: "experiment",
  },
  "format-quote": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M6.55 16.5L8 14q-1.65 0-2.825-1.175T4 10t1.175-2.825T8 6t2.825 1.175T12 10q0 .575-.137 1.063T11.45 12l-3.175 5.5q-.125.225-.35.363t-.5.137q-.575 0-.862-.5t-.013-1m9 0L17 14q-1.65 0-2.825-1.175T13 10t1.175-2.825T17 6t2.825 1.175T21 10q0 .575-.137 1.063T20.45 12l-3.175 5.5q-.125.225-.35.363t-.5.137q-.575 0-.862-.5t-.013-1"/>`,
    attribution: ICON_ATTRIBUTIONS.materialSymbols,
    name: "format-quote-rounded",
  },
  tip: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="m12 12.9l-2.03 2c-.46.46-.82 1.03-.93 1.67C8.74 18.41 10.18 20 12 20s3.26-1.59 2.96-3.42c-.11-.64-.46-1.22-.93-1.67z"/><path fill="currentColor" d="M15.56 6.55C14.38 8.02 12 7.19 12 5.3V3.77c0-.8-.89-1.28-1.55-.84C8.12 4.49 4 7.97 4 13c0 2.92 1.56 5.47 3.89 6.86a4.86 4.86 0 0 1-.81-3.68c.19-1.04.75-1.98 1.51-2.72l2.71-2.67c.39-.38 1.01-.38 1.4 0l2.73 2.69c.74.73 1.3 1.65 1.48 2.68c.25 1.36-.07 2.64-.77 3.66c1.89-1.15 3.29-3.06 3.71-5.3c.61-3.27-.81-6.37-3.22-8.1c-.33-.25-.8-.2-1.07.13"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-local-fire-department",
  },
  "chevron-up": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M8.12 14.71L12 10.83l3.88 3.88a.996.996 0 1 0 1.41-1.41L12.7 8.71a.996.996 0 0 0-1.41 0L6.7 13.3a.996.996 0 0 0 0 1.41c.39.38 1.03.39 1.42 0"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-keyboard-arrow-up",
  },
  "chevron-down": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M8.12 9.29L12 13.17l3.88-3.88a.996.996 0 1 1 1.41 1.41l-4.59 4.59a.996.996 0 0 1-1.41 0L6.7 10.7a.996.996 0 0 1 0-1.41c.39-.38 1.03-.39 1.42 0"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-keyboard-arrow-down",
  },
  "chevron-right": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M9.29 15.88L13.17 12L9.29 8.12a.996.996 0 1 1 1.41-1.41l4.59 4.59c.39.39.39 1.02 0 1.41L10.7 17.3a.996.996 0 0 1-1.41 0c-.38-.39-.39-1.03 0-1.42"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-keyboard-arrow-right",
  },
  "chevron-left": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M14.71 15.88L10.83 12l3.88-3.88a.996.996 0 1 0-1.41-1.41L8.71 11.3a.996.996 0 0 0 0 1.41l4.59 4.59c.39.39 1.02.39 1.41 0c.38-.39.39-1.03 0-1.42"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-keyboard-arrow-left",
  },
  "arrow-outward": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="m16 8.4l-8.9 8.9q-.275.275-.7.275t-.7-.275t-.275-.7t.275-.7L14.6 7H7q-.425 0-.712-.288T6 6t.288-.712T7 5h10q.425 0 .713.288T18 6v10q0 .425-.288.713T17 17t-.712-.288T16 16z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialSymbols,
    name: "arrow-outward-rounded",
  },
  "link": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M7 17q-2.075 0-3.537-1.463T2 12t1.463-3.537T7 7h3q.425 0 .713.288T11 8t-.288.713T10 9H7q-1.25 0-2.125.875T4 12t.875 2.125T7 15h3q.425 0 .713.288T11 16t-.288.713T10 17zm2-4q-.425 0-.712-.288T8 12t.288-.712T9 11h6q.425 0 .713.288T16 12t-.288.713T15 13zm5 4q-.425 0-.712-.288T13 16t.288-.712T14 15h3q1.25 0 2.125-.875T20 12t-.875-2.125T17 9h-3q-.425 0-.712-.288T13 8t.288-.712T14 7h3q2.075 0 3.538 1.463T22 12t-1.463 3.538T17 17z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialSymbols,
    name: "link-rounded",
  },
  "fullscreen": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M5 19h2q.425 0 .713.288T8 20t-.288.713T7 21H4q-.425 0-.712-.288T3 20v-3q0-.425.288-.712T4 16t.713.288T5 17zm14 0v-2q0-.425.288-.712T20 16t.713.288T21 17v3q0 .425-.288.713T20 21h-3q-.425 0-.712-.288T16 20t.288-.712T17 19zM5 5v2q0 .425-.288.713T4 8t-.712-.288T3 7V4q0-.425.288-.712T4 3h3q.425 0 .713.288T8 4t-.288.713T7 5zm14 0h-2q-.425 0-.712-.288T16 4t.288-.712T17 3h3q.425 0 .713.288T21 4v3q0 .425-.288.713T20 8t-.712-.288T19 7z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialSymbols,
    name: "fullscreen-rounded",
  },
  "fullscreen-exit": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M6 18H4q-.425 0-.712-.288T3 17t.288-.712T4 16h3q.425 0 .713.288T8 17v3q0 .425-.288.713T7 21t-.712-.288T6 20zm12 0v2q0 .425-.288.713T17 21t-.712-.288T16 20v-3q0-.425.288-.712T17 16h3q.425 0 .713.288T21 17t-.288.713T20 18zM6 6V4q0-.425.288-.712T7 3t.713.288T8 4v3q0 .425-.288.713T7 8H4q-.425 0-.712-.288T3 7t.288-.712T4 6zm12 0h2q.425 0 .713.288T21 7t-.288.713T20 8h-3q-.425 0-.712-.288T16 7V4q0-.425.288-.712T17 3t.713.288T18 4z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialSymbols,
    name: "fullscreen-exit-rounded",
  },
  upload: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M6 20q-.825 0-1.412-.587T4 18v-2q0-.425.288-.712T5 15t.713.288T6 16v2h12v-2q0-.425.288-.712T19 15t.713.288T20 16v2q0 .825-.587 1.413T18 20zm5-12.15L9.125 9.725q-.3.3-.712.288T7.7 9.7q-.275-.3-.288-.7t.288-.7l3.6-3.6q.15-.15.325-.212T12 4.425t.375.063t.325.212l3.6 3.6q.3.3.288.7t-.288.7q-.3.3-.712.313t-.713-.288L13 7.85V15q0 .425-.288.713T12 16t-.712-.288T11 15z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialSymbols,
    name: "upload-rounded",
  },
  download: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M11.625 15.513q-.175-.063-.325-.213l-3.6-3.6q-.3-.3-.288-.7t.288-.7q.3-.3.713-.312t.712.287L11 12.15V5q0-.425.288-.712T12 4t.713.288T13 5v7.15l1.875-1.875q.3-.3.713-.288t.712.313q.275.3.288.7t-.288.7l-3.6 3.6q-.15.15-.325.213t-.375.062t-.375-.062M6 20q-.825 0-1.412-.587T4 18v-2q0-.425.288-.712T5 15t.713.288T6 16v2h12v-2q0-.425.288-.712T19 15t.713.288T20 16v2q0 .825-.587 1.413T18 20z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialSymbols,
    name: "download-rounded",
  },
  calendar: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M5 22q-.825 0-1.412-.587T3 20V6q0-.825.588-1.412T5 4h1V3q0-.425.288-.712T7 2t.713.288T8 3v1h8V3q0-.425.288-.712T17 2t.713.288T18 3v1h1q.825 0 1.413.588T21 6v14q0 .825-.587 1.413T19 22zm0-2h14V10H5z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialSymbols,
    name: "calendar-today-rounded",
  },
  clock: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2M12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8s8 3.58 8 8s-3.58 8-8 8m-.22-13h-.06c-.4 0-.72.32-.72.72v4.72c0 .35.18.68.49.86l4.15 2.49c.34.2.78.1.98-.24a.71.71 0 0 0-.25-.99l-3.87-2.3V7.72c0-.4-.32-.72-.72-.72"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-schedule",
  },
  check: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M9 16.17L5.53 12.7a.996.996 0 1 0-1.41 1.41l4.18 4.18c.39.39 1.02.39 1.41 0L20.29 7.71a.996.996 0 1 0-1.41-1.41z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-check",
  },
  minus: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M18 12.998H6a1 1 0 0 1 0-2h12a1 1 0 0 1 0 2"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-minus",
  },
  "plus": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M18 12.998h-5v5a1 1 0 0 1-2 0v-5H6a1 1 0 0 1 0-2h5v-5a1 1 0 0 1 2 0v5h5a1 1 0 0 1 0 2"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-plus",
  },
  "delete": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M7 21q-.825 0-1.412-.587T5 19V6q-.425 0-.712-.288T4 5t.288-.712T5 4h4q0-.425.288-.712T10 3h4q.425 0 .713.288T15 4h4q.425 0 .713.288T20 5t-.288.713T19 6v13q0 .825-.587 1.413T17 21zm3.713-4.288Q11 16.426 11 16V9q0-.425-.288-.712T10 8t-.712.288T9 9v7q0 .425.288.713T10 17t.713-.288m4 0Q15 16.426 15 16V9q0-.425-.288-.712T14 8t-.712.288T13 9v7q0 .425.288.713T14 17t.713-.288"/>`,
    attribution: ICON_ATTRIBUTIONS.materialSymbols,
    name: "delete-rounded",
  },
  "remove": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M5 13v-2h14v2z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialSymbols,
    name: "remove",
  },
  "type-text": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M7.438 19.563Q7 19.125 7 18.5V7H3.5q-.625 0-1.062-.437T2 5.5t.438-1.062T3.5 4h10q.625 0 1.063.438T15 5.5t-.437 1.063T13.5 7H10v11.5q0 .625-.437 1.063T8.5 20t-1.062-.437m9 0Q16 19.125 16 18.5V12h-1.5q-.625 0-1.062-.437T13 10.5t.438-1.062T14.5 9h6q.625 0 1.063.438T22 10.5t-.437 1.063T20.5 12H19v6.5q0 .625-.437 1.063T17.5 20t-1.062-.437"/>`,
    attribution: ICON_ATTRIBUTIONS.materialSymbols,
    name: "text-fields-rounded",
  },
  "type-number": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="m9 16l-.825 3.275q-.075.325-.325.525t-.6.2q-.475 0-.775-.375T6.3 18.8L7 16H4.275q-.5 0-.8-.387T3.3 14.75q.075-.35.35-.55t.625-.2H7.5l1-4H5.775q-.5 0-.8-.387T4.8 8.75q.075-.35.35-.55t.625-.2H9l.825-3.275Q9.9 4.4 10.15 4.2t.6-.2q.475 0 .775.375t.175.825L11 8h4l.825-3.275q.075-.325.325-.525t.6-.2q.475 0 .775.375t.175.825L17 8h2.725q.5 0 .8.387t.175.863q-.075.35-.35.55t-.625.2H16.5l-1 4h2.725q.5 0 .8.388t.175.862q-.075.35-.35.55t-.625.2H15l-.825 3.275q-.075.325-.325.525t-.6.2q-.475 0-.775-.375T12.3 18.8L13 16zm.5-2h4l1-4h-4z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialSymbols,
    name: "numbers-rounded",
  },
  "type-logical": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="m10.6 13.8l-2.15-2.15q-.275-.275-.7-.275t-.7.275t-.275.7t.275.7L9.9 15.9q.3.3.7.3t.7-.3l5.65-5.65q.275-.275.275-.7t-.275-.7t-.7-.275t-.7.275zM12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22"/>`,
    attribution: ICON_ATTRIBUTIONS.materialSymbols,
    name: "check-circle-rounded",
  },
  "copy": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M15 20H5V7c0-.55-.45-1-1-1s-1 .45-1 1v13c0 1.1.9 2 2 2h10c.55 0 1-.45 1-1s-.45-1-1-1m5-4V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h9c1.1 0 2-.9 2-2m-2 0H9V4h9z"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-content-copy",
  },
  "paste": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M19 2h-4.18C14.4.84 13.3 0 12 0S9.6.84 9.18 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-7 0c.55 0 1 .45 1 1s-.45 1-1 1s-1-.45-1-1s.45-1 1-1m6 18H6c-.55 0-1-.45-1-1V5c0-.55.45-1 1-1h1v1c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V4h1c.55 0 1 .45 1 1v14c0 .55-.45 1-1 1"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-content-paste",
  },
  "paste-special": {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M5 5h2v1c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V5h2v6h2V5c0-1.1-.9-2-2-2h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h5v-2H5zm7-2c.55 0 1 .45 1 1s-.45 1-1 1s-1-.45-1-1s.45-1 1-1"/><path fill="currentColor" d="m21.29 16.29l-2.58-2.58a.996.996 0 1 0-1.41 1.41l.87.88H13c-.55 0-1 .45-1 1s.45 1 1 1h5.17l-.87.88a.996.996 0 1 0 1.41 1.41l2.58-2.58c.39-.4.39-1.03 0-1.42"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-content-paste-go",
  },
  clear: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59L7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12L5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4"/>`,
    name: "round-clear",
    attribution: ICON_ATTRIBUTIONS.materialIcons,
  },
  highlight: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M8.7 15.9L4.8 12l3.9-3.9a.984.984 0 0 0 0-1.4a.984.984 0 0 0-1.4 0l-4.59 4.59a.996.996 0 0 0 0 1.41l4.59 4.6c.39.39 1.01.39 1.4 0a.984.984 0 0 0 0-1.4m6.6 0l3.9-3.9l-3.9-3.9a.984.984 0 0 1 0-1.4a.984.984 0 0 1 1.4 0l4.59 4.59c.39.39.39 1.02 0 1.41l-4.59 4.6a.984.984 0 0 1-1.4 0a.984.984 0 0 1 0-1.4"/>`,
    name: "round-code",
    attribution: ICON_ATTRIBUTIONS.materialIcons,
  },
  palette: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10a2.5 2.5 0 0 0 2.5-2.5c0-.61-.23-1.2-.64-1.67a.53.53 0 0 1-.13-.33c0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6c0-4.96-4.49-9-10-9m5.5 11c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5s1.5.67 1.5 1.5s-.67 1.5-1.5 1.5m-3-4c-.83 0-1.5-.67-1.5-1.5S13.67 6 14.5 6s1.5.67 1.5 1.5S15.33 9 14.5 9M5 11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5S7.33 13 6.5 13S5 12.33 5 11.5m6-4c0 .83-.67 1.5-1.5 1.5S8 8.33 8 7.5S8.67 6 9.5 6s1.5.67 1.5 1.5"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-palette",
  },
};
