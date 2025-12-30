type OrganizationSectionProps = {
  isOrganizing: boolean;
  label: string;
  onStart: () => void;
  onCancel: () => void;
};

export const OrganizationSection = ({
  isOrganizing,
  label,
  onStart,
  onCancel,
}: OrganizationSectionProps) => {
  return (
    <section className="add-component-panel__organization">
      <div className="add-component-panel__organization-header">
        <span>Organización</span>
        <span className="add-component-panel__organization-pill">
          {isOrganizing ? "Organizando" : "Inactivo"}
        </span>
      </div>
      <p className="add-component-panel__organization-text">
        Organiza los elementos dentro de {label}.
      </p>
      <div className="add-component-panel__organization-actions">
        {isOrganizing ? (
          <button
            className="add-component-panel__diagram-button add-component-panel__diagram-button--ghost"
            type="button"
            onClick={onCancel}
          >
            Cancelar
          </button>
        ) : (
          <button
            className="add-component-panel__diagram-button"
            type="button"
            onClick={onStart}
          >
            Organizar
          </button>
        )}
      </div>
    </section>
  );
};