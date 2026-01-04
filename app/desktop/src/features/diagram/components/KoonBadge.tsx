import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { COMPONENT_SIZE } from "../hooks/layout/utils/constants";
import { useNodeEdit } from "../hooks/useNodeEdit";
import { buildGateColorVars, resolveGateColor } from "../utils/gateColors";

type KoonBadgeProps = {
  gateId: string;
  k: number;
  n: number;
  position: { x: number; y: number };
  color?: string | null;
  onGraphReload?: () => void;
};

export const KOON_BADGE_DIAMETER = COMPONENT_SIZE.height * 0.7;
export const KOON_BADGE_RADIUS = KOON_BADGE_DIAMETER / 2;

export const KoonBadge = ({
  gateId,
  k,
  n,
  position,
  color,
  onGraphReload,
}: KoonBadgeProps) => {
  const badgeRef = useRef<HTMLDivElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(k));
  const [serverError, setServerError] = useState<string | null>(null);
  const { isSaving, editGate } = useNodeEdit();
  const diameter = KOON_BADGE_DIAMETER;

  useEffect(() => {
    if (isEditing) return;
    setInputValue(String(k));
    setServerError(null);
  }, [isEditing, k]);

  useEffect(() => {
    if (!isEditing) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const badgeNode = badgeRef.current;
      if (!badgeNode) return;
      const path = event.composedPath?.() ?? [];
      if (path.includes(badgeNode) || badgeNode.contains(target)) return;
      setIsEditing(false);
      setInputValue(String(k));
      setServerError(null);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isEditing, k]);

  const parsedK = useMemo(() => {
    if (!inputValue.trim()) return null;
    const value = Number(inputValue);
    if (!Number.isInteger(value)) return null;
    return value;
  }, [inputValue]);

  const validationError = useMemo(() => {
    if (!inputValue.trim()) {
      return "Ingresa un valor para K.";
    }
    if (parsedK === null) {
      return "K debe ser un entero.";
    }
    if (parsedK < 1 || parsedK > n) {
      return `K debe estar entre 1 y ${n}.`;
    }
    return null;
  }, [inputValue, parsedK, n]);

  const isValid = validationError === null;
  const isDirty = parsedK !== null && parsedK !== k;

  const startEdit = () => {
    if (n <= 0) return;
    setIsEditing(true);
    setInputValue(String(k));
    setServerError(null);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setInputValue(String(k));
    setServerError(null);
  };

  const commitEdit = async () => {
    if (!isValid || parsedK === null || !isDirty) return;
    const error = await editGate(gateId, { k: parsedK });
    if (error) {
      setServerError(error.message);
      return;
    }
    setServerError(null);
    setIsEditing(false);
    onGraphReload?.();
  };

  const gateColor = resolveGateColor("KOON", color ?? null);
  const colorVars = buildGateColorVars(gateColor) as CSSProperties;

  return (
    <div
      ref={badgeRef}
      className={`diagram-koon-badge${isEditing ? " diagram-koon-badge--editing" : ""}${
        isValid ? "" : " diagram-koon-badge--invalid"
      }`}
      style={{
        left: position.x - KOON_BADGE_RADIUS,
        top: position.y - KOON_BADGE_RADIUS,
        width: diameter,
        height: diameter,
        ...colorVars,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation();
        startEdit();
      }}
      role="button"
      aria-label={`Editar K del gate ${gateId}`}
    >
      {!isEditing ? (
        <span className="diagram-koon-badge__label">{`${k}/${n}`}</span>
      ) : (
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={n}
          step={1}
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            if (serverError) setServerError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              cancelEdit();
            }
            if (event.key === "Enter") {
              event.preventDefault();
              void commitEdit();
            }
          }}
          disabled={isSaving}
          className="diagram-koon-badge__input"
          onPointerDown={(event) => event.stopPropagation()}
          autoFocus
        />
      )}
      {isEditing && (validationError || serverError) ? (
        <span className="diagram-koon-badge__error">
          {serverError ?? validationError}
        </span>
      ) : null}
    </div>
  );
};