import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RemoteComponent } from "../../../services/remote/componentsService";
import { DiagramElementSelector } from "./DiagramElementSelector";
import type { DiagramNodeSelection, SelectionStatus } from "../types/selection";
import type { GateType } from "../types/gates";
import type { AddComponentFormState } from "../types/addComponent";
import { CalculationTypeSelector } from "./addComponent/sections/CalculationTypeSelector";
import { calculationTypeOptions } from "../icons/calculationTypeIcons";
import { ComponentSearchSection } from "./addComponent/sections/ComponentSearchSection";
import { GateTypeSelector } from "./addComponent/sections/GateTypeSelector";
import { OrganizationSection } from "./addComponent/sections/OrganizationSection";
import { SelectedComponentCard } from "./addComponent/sections/SelectedComponentCard";
import type { ComponentSearchResult } from "./addComponent/hooks/useComponentSearch";

type AddComponentStep = "selection" | "gateType" | "organization";

type AddComponentPanelProps = {
  step: AddComponentStep;
  selectionStatus: SelectionStatus;
  draftSelection: DiagramNodeSelection | null;
  gateType: GateType | null;
  isOrganizing: boolean;
  confirmedSelection: DiagramNodeSelection | null;
  formState: AddComponentFormState;
  existingNodeIds?: Set<string>;
  resetToken?: number;
  searchState: ComponentSearchResult;
  isRootInsertMode?: boolean;
  onCancelAdd: () => void;
  onComponentSelect: (componentId: string, componentName: string) => void;
  onSelectionConfirm: (selection: DiagramNodeSelection) => void;
  onSelectionCancel: () => void;
  onSelectionCleared: () => void;
  onSelectionStart: () => void;
  onGateTypeChange: (gateType: GateType | null) => void;
  onSelectionReset: () => void;
  onFormStateChange: (nextState: AddComponentFormState) => void;
  onOrganizationStart: () => void;
  onOrganizationCancel: () => void;
  onInsert: () => void;
};

export const AddComponentPanel = ({
  step,
  selectionStatus,
  draftSelection,
  gateType,
  isOrganizing,
  confirmedSelection,
  formState,
  existingNodeIds = new Set<string>(),
  resetToken = 0,
  searchState,
  isRootInsertMode = false,
  onCancelAdd,
  onComponentSelect,
  onSelectionConfirm,
  onSelectionCancel,
  onSelectionCleared,
  onSelectionStart,
  onGateTypeChange,
  onSelectionReset,
  onFormStateChange,
  onOrganizationStart,
  onOrganizationCancel,
  onInsert,
}: AddComponentPanelProps) => {
  const [selectedComponent, setSelectedComponent] =
    useState<RemoteComponent | null>(null);
  const selectionResetRef = useRef<string | null>(null);
  const stepResetRef = useRef<AddComponentStep | null>(null);

  useEffect(() => {
    if (selectionResetRef.current === confirmedSelection?.id) return;
    selectionResetRef.current = confirmedSelection?.id ?? null;
    if (confirmedSelection?.type === "gate") {
      return;
    }
    onGateTypeChange(null);
  }, [confirmedSelection?.id, confirmedSelection?.type, onGateTypeChange]);

  useEffect(() => {
    if (stepResetRef.current === step) return;
    stepResetRef.current = step;
    if (step === "gateType") {
      onGateTypeChange(null);
    }
  }, [onGateTypeChange, step]);

  useEffect(() => {
    setSelectedComponent(null);
  }, [resetToken]);

  useEffect(() => {
    if (formState.componentId) return;
    setSelectedComponent(null);
  }, [formState.componentId]);

  const handleSelectComponent = useCallback(
    (item: RemoteComponent) => {
      setSelectedComponent(item);
      onFormStateChange({
        ...formState,
        componentId: item.id,
        calculationType: "exponential",
      });
      onComponentSelect(item.id, item.kks_name);
    },
    [formState, onFormStateChange, onComponentSelect],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedComponent(null);
    onFormStateChange({
      ...formState,
      componentId: null,
      calculationType: "exponential",
    });
    onGateTypeChange(null);
    onSelectionReset();
  }, [formState, onFormStateChange, onGateTypeChange, onSelectionReset]);

  const calculationOptions = calculationTypeOptions;

  const gateOptions = [
    {
      value: "and" as const,
      label: "AND",
    },
    {
      value: "or" as const,
      label: "OR",
    },
    {
      value: "koon" as const,
      label: "KOON",
    },
  ];

  const subtitle = selectedComponent
    ? isRootInsertMode
      ? "Confirma si quieres agregarlo como componente raíz del diagrama."
      : step === "selection"
      ? "Selecciona el elemento del diagrama para insertar el componente."
      : confirmedSelection?.type === "component" ||
          confirmedSelection?.type === "collapsedGate"
        ? "Escoge tipo de gate y reordena los elementos en el orden que quieras."
        : "Continúa con la organización del diagrama."
    : "Busca componentes remotos para añadirlos al diagrama.";

  const shouldShowGateSection =
    (confirmedSelection?.type === "component" ||
      confirmedSelection?.type === "collapsedGate") &&
    (step === "gateType" || step === "organization");
  const shouldShowOrganizationSection = step === "organization";
  const organizationLabel = confirmedSelection?.type === "gate"
    ? `la gate ${confirmedSelection.id}`
    : gateType
      ? `el nuevo ${gateType.toUpperCase()}`
      : "el nuevo gate";
  const gateSectionResetKey = useMemo(
    () => `${resetToken}-${step}-${confirmedSelection?.id ?? "none"}`,
    [confirmedSelection?.id, resetToken, step],
  );

  return (
    <section className="add-component-panel">
      <header className="add-component-panel__header">
        <div className="add-component-panel__header-text">
          <h2 className="add-component-panel__title">Agregar componente</h2>
          <p className="add-component-panel__subtitle">{subtitle}</p>
        </div>
        <button
          className="add-component-panel__close"
          type="button"
          onClick={onCancelAdd}
          aria-label="Cancelar agregar componente"
        >
          ×
        </button>
      </header>

      {selectedComponent ? (
        <>
          <SelectedComponentCard
            component={selectedComponent}
            onClear={handleClearSelection}
            resetToken={resetToken}
          />

          <CalculationTypeSelector
            value={formState.calculationType}
            onChange={(type) =>
              onFormStateChange({
                ...formState,
                calculationType: type,
              })
            }
            options={calculationOptions}
            resetToken={resetToken}
          />

          {!isRootInsertMode ? (
            <DiagramElementSelector
              status={selectionStatus}
              draftSelection={draftSelection}
              confirmedSelection={confirmedSelection}
              isAutoTarget={Boolean(formState.autoTarget)}
              onSelectionConfirmed={onSelectionConfirm}
              onSelectionCleared={onSelectionCleared}
              onSelectionCanceled={onSelectionCancel}
              onSelectionStart={onSelectionStart}
            />
          ) : null}

          {shouldShowGateSection ? (
            <GateTypeSelector
              value={gateType}
              onChange={onGateTypeChange}
              options={gateOptions}
              resetToken={resetToken}
              resetKey={gateSectionResetKey}
            />
          ) : null}

          {shouldShowOrganizationSection ? (
            <OrganizationSection
              isOrganizing={isOrganizing}
              label={organizationLabel}
              onStart={onOrganizationStart}
              onCancel={onOrganizationCancel}
            />
          ) : null}

          {shouldShowOrganizationSection ? (
            <div className="add-component-panel__footer">
              <button
                className="add-component-panel__diagram-button add-component-panel__diagram-button--primary"
                type="button"
                onClick={onInsert}
              >
                Insertar
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <ComponentSearchSection
          existingNodeIds={existingNodeIds}
          onComponentSelect={handleSelectComponent}
          searchState={searchState}
        />
      )}
    </section>
  );
};