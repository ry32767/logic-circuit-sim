import { bezierPath } from '../lib/circuit/geometry';

interface WireProps {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  value: boolean;
  onDelete: (id: string) => void;
}

export function Wire({ id, from, to, value, onDelete }: WireProps) {
  const d = bezierPath(from, to);
  return (
    <g className="lcs-wire-group">
      {/* クリックしやすいよう透明な太い当たり判定 */}
      <path
        d={d}
        className="lcs-wire-hit"
        onPointerDown={(e) => {
          e.stopPropagation();
          onDelete(id);
        }}
      />
      {/* 表示用のワイヤー（信号値で色が変わる） */}
      <path
        d={d}
        className={'lcs-wire' + (value ? ' high' : '')}
        aria-label={value ? '配線（HIGH）' : '配線（LOW）'}
      />
    </g>
  );
}
