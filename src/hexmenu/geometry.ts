// ─── SHARED HEX MATH ───
// Pure geometry only: no Svelte, no DOM, no events. Used by both
// HexMenu.svelte (interactive nodes) and HexGrid.svelte (decorative
// background tiles), so the two stay pixel-perfect in sync — there is
// exactly one formula for "where is hex (col, row)", not two.

export interface HexPoint {
    x: number;
    y: number;
  }
  
  // ─── BASE HEX GRID CONSTANTS (unscaled, from grid.svg geometry) ───
  export const BASE_COL = 100.0;
  export const BASE_ROW = 86.6;
  export const BASE_R = 56.15;
  export const MIN_COLS_VISIBLE = 4;
  export const MIN_ROWS_VISIBLE = 6;
  
  // Center point of hex (col, lrow) inside a grid anchored at (aCol, aRow),
  // using column/row spacing (col_, row_).
  export function hexCenter(
    col: number,
    lrow: number,
    aCol: number,
    aRow: number,
    col_: number,
    row_: number
  ): HexPoint {
    const absRow = aRow + lrow;
    const xOffset = absRow % 2 === 1 ? col_ / 2 : 0;
    const colShift = (aRow % 2 === 1 && lrow % 2 === 1) ? 1 : 0;
    const x = (col + colShift) * col_ + xOffset;
    const y = absRow * row_;
    return { x, y };
  }
  
  // SVG path for a flat-top hexagon centered at (cx, cy) with the given radius.
  export function hexPath(cx: number, cy: number, radius: number): string {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
    }
    return `M${pts.join('L')}Z`;
  }
  
  // Worst-case bounding box: measured, not derived. Probes a
  // minCols × minRows grid through the exact same hexCenter() used for
  // the real nodes, at the current anchor position. This guarantees the
  // box always matches whatever hexCenter() actually does — no separate
  // formula to keep in sync by hand, and no assumption baked in about
  // which rows end up wider because of colShift/xOffset.
  export function computeNeededBox(
    minCols: number,
    minRows: number,
    aCol: number,
    aRow: number,
    col_: number,
    row_: number,
    r: number
  ): { width: number; height: number } {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let lrow = 0; lrow < minRows; lrow++) {
      for (let col = 0; col < minCols; col++) {
        const { x, y } = hexCenter(col, lrow, aCol, aRow, col_, row_);
        minX = Math.min(minX, x - r);
        maxX = Math.max(maxX, x + r);
        minY = Math.min(minY, y - r);
        maxY = Math.max(maxY, y + r);
      }
    }
    return { width: maxX - minX, height: maxY - minY };
  }
  
  // Decorative full-area background hex tiling (col_/row_ already scaled
  // by the caller). Covers (vw × vh) plus a one-hex margin on every side.
  export function computeBgHexes(vw: number, vh: number, col_: number, row_: number): HexPoint[] {
    if (!col_ || !row_) return [];
    const cols = Math.ceil(vw / col_) + 3;
    const rows = Math.ceil(vh / row_) + 3;
    const out: HexPoint[] = [];
    for (let r = -1; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const isOdd = r % 2 === 1;
        const x = c * col_ + (isOdd ? col_ / 2 : 0);
        const y = r * row_;
        out.push({ x, y });
      }
    }
    return out;
  }
  
  // Greedy word-wrap for hex labels — model names come straight from the
  // domain/model table (variable length), so they need to wrap
  // themselves instead of being hand-wrapped.
  export function wrapLabel(text: string, maxLineLen = 11): string {
    const words = text.toUpperCase().split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const candidate = cur ? `${cur} ${w}` : w;
      if (cur && candidate.length > maxLineLen) {
        lines.push(cur);
        cur = w;
      } else {
        cur = candidate;
      }
    }
    if (cur) lines.push(cur);
    return lines.join('\n');
  }