import { useMemo } from "react";
import { getGraphSummary } from "./core/graph";
import { DiagramHeader } from "./features/diagram/components/DiagramHeader";
import { DiagramStatusPanel } from "./features/diagram/components/DiagramStatusPanel";
import { DiagramSummary } from "./features/diagram/components/DiagramSummary";
import { useDiagramGraph } from "./features/diagram/hooks/useDiagramGraph";
import { GateList } from "./features/gates/components/GateList";
import { useGates } from "./features/gates/hooks/useGates";
import { NodeList } from "./features/nodes/components/NodeList";
import { useNodes } from "./features/nodes/hooks/useNodes";
import { BACKEND_ENDPOINT } from "./services/graphService";

function App() {
    const { graph, status, errorMessage } = useDiagramGraph();
    const nodes = useNodes(graph);
    const gates = useGates(graph);
    const summary = useMemo(() => getGraphSummary(graph), [graph]);

  return (
    <div className="app">
      <DiagramHeader endpoint={BACKEND_ENDPOINT} />
      <DiagramStatusPanel status={status} errorMessage={errorMessage} />
      <DiagramSummary summary={summary} />
      <NodeList nodes={nodes} />
      <GateList gates={gates} />
    </div>
  );
}

export default App;