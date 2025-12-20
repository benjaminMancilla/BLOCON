import { DiagramCanvas } from "./features/diagram/components/DiagramCanvas";
import { DiagramTopBar } from "./features/diagram/components/DiagramTopBar";

function App() {

  return (
    <div className="app">
      <DiagramTopBar />
      <DiagramCanvas />
    </div>
  );
}

export default App;