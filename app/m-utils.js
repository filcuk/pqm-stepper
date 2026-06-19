/** Shared Power Query M parsing helpers. */

export const QUOTED_TOKEN_RE = /#"([^"]+)"/g;

export const STEP_DECL_RE =
  /(?:^|\n)\s*(?:(#"([^"]+)")|([A-Za-z_][A-Za-z0-9_]*))\s*=/gm;

export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
