import type { DiagramLayoutLine } from "../../../hooks/useDiagramLayout";

type DiagramEdgesProps = {
  width: number;
  height: number;
  lines: DiagramLayoutLine[];
};

export const DiagramEdges = ({ width, height, lines }: DiagramEdgesProps) => (
  <svg
    className="diagram-canvas__edges"
    width={width}
    height={height}
    viewBox={`0 0 ${width} ${height}`}
    aria-hidden="true"
  >
    <defs>
      <marker
        id="diagram-arrow"
        markerWidth="6"
        markerHeight="6"
        refX="5"
        refY="3"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M0,0 L6,3 L0,6 Z" className="diagram-edge__arrow" />
      </marker>
    </defs>
    {lines.map((line, index) => (
      <line
        key={`${line.kind}-${index}`}
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        markerEnd={line.arrow ? "url(#diagram-arrow)" : undefined}
        className={`diagram-edge diagram-edge--${line.kind}`}
      />
    ))}
  </svg>
);