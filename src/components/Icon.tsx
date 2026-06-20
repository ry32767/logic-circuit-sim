import { ICON_PATHS, type IconName } from '../lib/icons';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

/**
 * Material Icons をインライン SVG で描画する共通アイコン。
 * fill は currentColor なので、親の文字色（テーマ）に追従する。
 * 装飾目的のため aria-hidden（ボタン側に aria-label を付ける前提）。
 */
export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
