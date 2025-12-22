import { useState } from "react";
import { DiagramCanvas } from "./features/diagram/components/DiagramCanvas";
import { DiagramSidePanel } from "./features/diagram/components/DiagramSidePanel";
import { DiagramTopBar } from "./features/diagram/components/DiagramTopBar";
import { AddComponentPanel } from "./features/diagram/components/AddComponentPanel";

function App() {
  const [isAddMode, setIsAddMode] = useState(false);

  return (
    <div className="app">
      <DiagramTopBar
        isAddMode={isAddMode}
        onToggleAddMode={() => setIsAddMode((current) => !current)}
      />
      <div className="diagram-workspace">
        <DiagramCanvas />
        {isAddMode ? (
          <DiagramSidePanel>
            <AddComponentPanel />
          </DiagramSidePanel>
        ) : null}
      </div>
    </div>
  );
}

export default App;