import { useDiagramCamera } from "../hooks/useDiagramCamera";

type DiagramCanvasProps = {
  label?: string;
};

export const DiagramCanvas = ({ label = "Canvas" }: DiagramCanvasProps) => {
  const { cameraStyle, handlers } = useDiagramCamera();

  return (
    <section className="diagram-canvas" aria-label={label}>
      <div className="diagram-canvas__surface" {...handlers}>
        <div className="diagram-canvas__viewport" style={cameraStyle}>
          <div className="diagram-canvas__placeholder">
            <div className="diagram-canvas__node">Nodo ejemplo</div>
            <p>
              Aquí vivirá el diagrama. Pan con el mouse y zoom con la rueda.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};