import React, { useState, useCallback, useEffect } from "react";
import ReactDOM from "react-dom";
import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import { motion } from "framer-motion";
import {
  MdSettings,
  MdDelete,
  MdAdd,
  MdKey,
  MdExpandMore,
  MdOutlineVerticalAlignTop,
  MdOutlineVerticalAlignBottom,
  MdDragIndicator,
} from "react-icons/md";
import { IoDuplicateOutline } from "react-icons/io5";
import { FiUnlock } from "react-icons/fi";
import { FieldConnectionHandles } from "./FieldConnectionHandles";
import { useReorderableRows } from "../hooks/useReorderableRows";
import type { NodeRenderConfig, TableColumn } from "../types/canvas";
import {
  isContentSizedTableNode,
  isFieldAddressableERTable,
} from "../utils/erdNode";

export type TableAttribute = {
  id: string;
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isUnique?: boolean;
  isNullable?: boolean;
};

export type TableNodeData = {
  label: string;
  icon?:
    | string
    | React.ComponentType<{
        size?: number;
        "aria-hidden"?: React.AriaAttributes["aria-hidden"];
      }>;
  componentName?: string;
  subtitle?: string;
  componentId?: string; // Component ID like 'uml-class', 'entity', etc.
  description?: string;
  attributes?: TableAttribute[] | string; // Can be array or JSON string
  renderConfig?: NodeRenderConfig; // Column configuration
  isCollapsed?: boolean;
  [key: string]: unknown;
};

const getEntityRowHoverBackground = (
  backgroundColor: string,
  textColor?: string,
) =>
  `color-mix(in srgb, ${backgroundColor} 88%, ${textColor || "var(--text)"} 12%)`;

function parseTableAttributes(value: TableNodeData["attributes"]): TableAttribute[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as TableAttribute[]) : [];
  } catch {
    return [];
  }
}

function getTableColumns(renderConfig?: NodeRenderConfig): TableColumn[] {
  if (renderConfig?.columns?.length) return renderConfig.columns;
  return [
    { key: "isPrimaryKey", label: "PK", width: "w-7", type: "boolean" },
    { key: "isForeignKey", label: "FK", width: "w-7", type: "boolean" },
    {
      key: "name",
      label: "Column Name",
      width: "flex-1",
      type: "text",
      editable: true,
    },
    {
      key: "type",
      label: "Data Type",
      width: "w-24",
      type: "text",
      editable: true,
    },
    { key: "actions", label: "", width: "w-8", type: "readonly" },
  ];
}

function getTableActionLabel(componentId: string | undefined, label: string) {
  if (componentId === "weak-entity") return "Weak Entity";
  if (componentId === "entity" || componentId === "er-entity") return "Entity";
  if (componentId === "er-view") return "View";
  return label || "Table";
}

function useTableAttributePorts(
  attributes: TableAttribute[],
  scrollRef: React.RefObject<HTMLDivElement | null>,
  rowRefs: React.RefObject<Map<string, HTMLDivElement>>,
  editingAttrId: string | null,
) {
  const [positions, setPositions] = useState<
    Array<{ id: string; top: number; visible: boolean }>
  >([]);
  const [layer, setLayer] = useState({ top: 0, height: 0 });

  const updatePositions = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    const viewportHeight = scrollElement.clientHeight;
    setLayer({ top: scrollElement.offsetTop, height: viewportHeight });
    const nextPositions = attributes.map((attribute) => {
      const row = rowRefs.current?.get(attribute.id);
      if (!row) return null;
      const top =
        row.offsetTop -
        scrollElement.offsetTop -
        scrollElement.scrollTop +
        row.offsetHeight / 2;
      return {
        id: attribute.id,
        top,
        visible: top >= -12 && top <= viewportHeight + 12,
      };
    });
    setPositions(
      nextPositions.filter(
        (position): position is NonNullable<typeof position> =>
          position !== null,
      ),
    );
  }, [attributes, rowRefs, scrollRef]);

  React.useLayoutEffect(() => {
    updatePositions();
    const scrollElement = scrollRef.current;
    if (!scrollElement || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updatePositions);
    observer.observe(scrollElement);
    return () => observer.disconnect();
  }, [editingAttrId, scrollRef, updatePositions]);

  return { positions, layer, updatePositions };
}

type Props = {
  id: string;
  data: TableNodeData;
  onCopy?: (id: string, data: TableNodeData) => void;
  isInGroup?: boolean;
};

function BooleanCellContent({
  columnKey,
  displayValue,
  icon,
}: Readonly<{
  columnKey: string;
  displayValue: boolean;
  icon?: React.ReactNode;
}>) {
  if (columnKey === "isPrimaryKey" && displayValue)
    return <MdKey className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />;
  if (columnKey === "isForeignKey" && displayValue)
    return (
      <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300">
        FK
      </span>
    );
  if (icon) return <span className="text-xs">{icon}</span>;
  if (columnKey !== "isPrimaryKey" && columnKey !== "isForeignKey")
    return <div className="w-3 h-3 border border-theme/40 rounded" />;
  return null;
}

type EditingValue = { name: string; type: string };

type ColumnCellProps = {
  col: TableColumn;
  attr: TableAttribute;
  isEditing: boolean;
  editingValue: EditingValue;
  editingInputRef: React.RefObject<HTMLInputElement | null>;
  textColor?: string;
  onToggleBoolean: (attributeId: string, key: string) => void;
  onChangeValue: React.Dispatch<React.SetStateAction<EditingValue>>;
  onStartEdit: (attribute: TableAttribute, event: React.SyntheticEvent) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDeleteAttribute: (attributeId: string) => void;
};

function renderBooleanColumnCell({ col, attr, onToggleBoolean }: ColumnCellProps) {
  const cellClassName = col.width || "flex-1";
  const value = Boolean(attr[col.key as keyof TableAttribute]);
  const displayValue = col.key === "isNullable" ? !value : value;
  const icon = displayValue ? col.icon?.active : col.icon?.inactive;
  const colorClass = displayValue ? col.color?.active : col.color?.inactive;
  return (
    <button
      key={col.key}
      type="button"
      onClick={() => onToggleBoolean(attr.id, col.key)}
      className={`${cellClassName} flex items-center justify-center ${colorClass || ""}`}
      aria-label={col.label}
      data-tooltip={col.label}
      aria-pressed={displayValue}
    >
      <BooleanCellContent
        columnKey={col.key}
        displayValue={displayValue}
        icon={icon}
      />
    </button>
  );
}

function renderEditableColumnCell({
  col,
  attr,
  isEditing,
  editingValue,
  editingInputRef,
  textColor,
  onChangeValue,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: ColumnCellProps) {
  const cellClassName = col.width || "flex-1";
  const attrValue = attr[col.key as keyof TableAttribute];
  if (isEditing) {
    return (
      <input
        key={col.key}
        ref={col.key === "name" ? editingInputRef : undefined}
        type="text"
        value={String(editingValue[col.key as keyof EditingValue] ?? attrValue ?? "")}
        onChange={(event) => onChangeValue({ ...editingValue, [col.key]: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSaveEdit();
          if (event.key === "Escape") onCancelEdit();
        }}
        className={`${cellClassName} px-1 py-0.5 bg-surface border border-theme/40 rounded text-xs`}
        onClick={(event) => event.stopPropagation()}
      />
    );
  }

  let textColorClass = "text-xs cursor-pointer";
  if (col.key === "name") {
    if (attr.isPrimaryKey) {
      textColorClass += " font-semibold text-yellow-600 dark:text-yellow-400";
    } else if (attr.isForeignKey) {
      textColorClass += " text-blue-600 dark:text-blue-400";
    }
  } else if (col.key === "type") {
    textColorClass += " text-muted";
  }

  return (
    <button
      key={col.key}
      type="button"
      className={`${cellClassName} truncate ${textColorClass} text-left bg-transparent border-none p-0`}
      style={textColor ? { color: textColor } : undefined}
      onDoubleClick={(event) => onStartEdit(attr, event)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onStartEdit(attr, event);
      }}
      data-tooltip="Double-click or press Enter to edit"
    >
      {String(attrValue || "")}
    </button>
  );
}

function renderReadonlyColumnCell({
  col,
  attr,
  isEditing,
  onSaveEdit,
  onDeleteAttribute,
}: ColumnCellProps) {
  const cellClassName = col.width || "flex-1";
  if (isEditing) {
    return (
      <button
        key="actions"
        type="button"
        onClick={onSaveEdit}
        className={`${cellClassName} text-green-600 hover:text-green-700 text-xs`}
        aria-label="Save attribute"
        data-tooltip="Save"
      >
        ✓
      </button>
    );
  }
  return (
    <button
      key="actions"
      type="button"
      onClick={() => onDeleteAttribute(attr.id)}
      className={`${cellClassName} opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700 transition-opacity`}
      aria-label="Delete attribute"
      data-tooltip="Delete attribute"
    >
      <MdDelete className="w-3 h-3" />
    </button>
  );
}

function renderTableColumnCell(props: ColumnCellProps): React.ReactNode {
  const { col, attr } = props;
  const attrValue = attr[col.key as keyof TableAttribute];
  if (col.type === "boolean") return renderBooleanColumnCell(props);
  if (col.type === "text" && col.editable) {
    return renderEditableColumnCell(props);
  }
  if (col.type === "readonly" && col.key === "actions") {
    return renderReadonlyColumnCell(props);
  }
  return (
    <span key={col.key} className={col.width || "flex-1"}>
      {String(attrValue || "")}
    </span>
  );
}

function useTableNodeInteractions({
  id,
  data,
  onCopy,
  editingAttrId,
  editingValue,
  setEditingAttrId,
  setEditingValue,
  contextMenu,
  setContextMenu,
}: {
  id: string;
  data: TableNodeData;
  onCopy?: (id: string, data: TableNodeData) => void;
  editingAttrId: string | null;
  editingValue: EditingValue;
  setEditingAttrId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingValue: React.Dispatch<React.SetStateAction<EditingValue>>;
  contextMenu: { visible: boolean; x: number; y: number };
  setContextMenu: React.Dispatch<
    React.SetStateAction<{ visible: boolean; x: number; y: number }>
  >;
}) {
  const onDelete = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    globalThis.dispatchEvent(
      new CustomEvent("diagram:node-delete", { detail: { id } }),
    );
  }, [id]);

  const onToggle = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    globalThis.dispatchEvent(
      new CustomEvent("diagram:node-toggle", { detail: { id } }),
    );
  }, [id]);

  const handleCollapseToggle = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    globalThis.dispatchEvent(
      new CustomEvent("diagram:table-collapse-toggle", { detail: { id } }),
    );
  }, [id]);

  const handleCopy = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onCopy?.(id, data);
  }, [id, data, onCopy]);

  const handleDetach = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    globalThis.dispatchEvent(
      new CustomEvent("diagram:node-detach", { detail: { id } }),
    );
  }, [id]);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY });
  }, [setContextMenu]);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, [setContextMenu]);

  const handleDeleteAttribute = useCallback((attributeId: string) => {
    globalThis.dispatchEvent(
      new CustomEvent("diagram:table-attribute-delete", {
        detail: { nodeId: id, attributeId },
      }),
    );
  }, [id]);

  const handleAddAttribute = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    const isUMLClass = data.componentId?.startsWith("uml-");
    const attribute: TableAttribute = isUMLClass
      ? {
          id: `attr-${Date.now()}`,
          name: "+ newMethod()",
          type: "void",
          isNullable: false,
        }
      : {
          id: `attr-${Date.now()}`,
          name: "newColumn",
          type: "VARCHAR(255)",
          isNullable: true,
        };
    globalThis.dispatchEvent(
      new CustomEvent("diagram:table-attribute-add", {
        detail: { nodeId: id, attribute },
      }),
    );
  }, [id, data.componentId]);

  const handleStartEdit = useCallback(
    (attribute: TableAttribute, event: React.SyntheticEvent) => {
      event.stopPropagation();
      setEditingAttrId(attribute.id);
      setEditingValue({ name: attribute.name, type: attribute.type });
    },
    [setEditingAttrId, setEditingValue],
  );

  const handleSaveEdit = useCallback(() => {
    if (!editingAttrId) return;
    globalThis.dispatchEvent(
      new CustomEvent("diagram:table-attribute-update", {
        detail: {
          nodeId: id,
          attributeId: editingAttrId,
          name: editingValue.name,
          type: editingValue.type,
        },
      }),
    );
    setEditingAttrId(null);
  }, [id, editingAttrId, editingValue, setEditingAttrId]);

  const handleCancelEdit = useCallback(() => setEditingAttrId(null), [setEditingAttrId]);

  const handleToggleBoolean = useCallback((attributeId: string, key: string) => {
    globalThis.dispatchEvent(
      new CustomEvent("diagram:table-attribute-toggle", {
        detail: { nodeId: id, attributeId, key },
      }),
    );
  }, [id]);

  useEffect(() => {
    if (!contextMenu.visible) return;
    const handleClick = (event: MouseEvent) => {
      const menu = document.querySelector("[data-context-menu]");
      if (menu && !menu.contains(event.target as Node)) closeContextMenu();
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("contextmenu", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("contextmenu", handleClick);
    };
  }, [contextMenu.visible, closeContextMenu]);

  return {
    onDelete,
    onToggle,
    handleCollapseToggle,
    handleCopy,
    handleDetach,
    handleContextMenu,
    closeContextMenu,
    handleDeleteAttribute,
    handleAddAttribute,
    handleStartEdit,
    handleSaveEdit,
    handleCancelEdit,
    handleToggleBoolean,
  };
}

const TableNode: React.FC<Props> = React.memo(
  ({ id, data, onCopy, isInGroup }) => {
    const [contextMenu, setContextMenu] = useState<{
      visible: boolean;
      x: number;
      y: number;
    }>({ visible: false, x: 0, y: 0 });

    const [editingAttrId, setEditingAttrId] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState({ name: "", type: "" });
    const editingInputRef = React.useRef<HTMLInputElement | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const updateNodeInternals = useUpdateNodeInternals();
    const attributeScrollRef = React.useRef<HTMLDivElement | null>(null);
    const attributeRowRefs = React.useRef(new Map<string, HTMLDivElement>());


    useEffect(() => {
      if (editingAttrId) editingInputRef.current?.focus();
    }, [editingAttrId]);

    const displayLabel = data.componentName || data.label;
    const actionLabel = getTableActionLabel(data.componentId, displayLabel);
    const subtitle = data.subtitle || data.description;
    const Icon = typeof data.icon === "function" ? data.icon : undefined;
    const isContentSizedTable = isContentSizedTableNode(data);
    const isERTable = isFieldAddressableERTable(data);
    // ER entities and UML table-shaped nodes all share the same collapsible
    // content treatment. ER-ness still only controls field-level handles.
    const isCollapsibleTable = isContentSizedTable;
    const isCollapsed = isCollapsibleTable && data.isCollapsed === true;
    const tableContentId = `table-node-content-${id}`;
    const backgroundColor =
      typeof data.backgroundColor === "string" && data.backgroundColor.trim()
        ? data.backgroundColor
        : undefined;
    const borderColor =
      typeof data.borderColor === "string" && data.borderColor.trim()
        ? data.borderColor
        : undefined;
    const textColor =
      typeof data.textColor === "string" && data.textColor.trim()
        ? data.textColor
        : undefined;
    const entityRowHoverBackground =
      isERTable && backgroundColor
        ? getEntityRowHoverBackground(backgroundColor, textColor)
        : undefined;

    // Parse attributes - it might be a JSON string or already an array
    const attributes = React.useMemo(
      () => parseTableAttributes(data.attributes),
      [data.attributes],
    );
    const {
      positions: attributePortPositions,
      layer: attributePortLayer,
      updatePositions: updateAttributePortPositions,
    } = useTableAttributePorts(
      attributes,
      attributeScrollRef,
      attributeRowRefs,
      editingAttrId,
    );

    const reorderAttributes = useCallback(
      (sourceId: string, targetId: string, position: "before" | "after") => {
        globalThis.dispatchEvent(
          new CustomEvent("diagram:table-attribute-reorder", {
            detail: { nodeId: id, sourceId, targetId, position },
          }),
        );
      },
      [id],
    );
    const rowReordering = useReorderableRows(
      attributes,
      () => "attributes",
      reorderAttributes,
    );

    React.useLayoutEffect(() => {
      updateNodeInternals(id);
    }, [attributePortPositions, id, isCollapsed, updateNodeInternals]);

    // Get column configuration from renderConfig or use defaults
    const columns = React.useMemo(
      () => getTableColumns(data.renderConfig),
      [data.renderConfig],
    );

    const {
      onDelete,
      onToggle,
      handleCollapseToggle,
      handleCopy,
      handleDetach,
      handleContextMenu,
      closeContextMenu,
      handleDeleteAttribute,
      handleAddAttribute,
      handleStartEdit,
      handleSaveEdit,
      handleCancelEdit,
      handleToggleBoolean,
    } = useTableNodeInteractions({
      id,
      data,
      onCopy,
      editingAttrId,
      editingValue,
      setEditingAttrId,
      setEditingValue,
      contextMenu,
      setContextMenu,
    });

    return (
      <>
        <motion.div
          initial={{ y: 0, opacity: 1 }}
          whileHover={{ y: -1, boxShadow: "0 12px 30px rgba(0,0,0,0.12)" }}
          whileTap={{ scale: 0.985 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className={`min-w-[220px] ${isERTable ? "w-[440px] min-w-[440px] max-w-[440px]" : isContentSizedTable ? "w-[360px] min-w-[360px] max-w-[360px]" : "max-h-[500px]"} bg-surface border-2 border-theme text-theme text-sm shadow-lg cursor-grab relative rounded-lg overflow-visible flex flex-col`}
          style={{
            ...(backgroundColor ? { backgroundColor } : {}),
            ...(borderColor ? { borderColor } : {}),
            ...(textColor ? { color: textColor } : {}),
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onContextMenu={handleContextMenu}
        >
          {/* Connection Handles */}
          <Handle
            id="top"
            type="source"
            position={Position.Top}
            isConnectable={true}
            style={{
              width: "100%",
              height: "8px",
              background: "transparent",
              border: "none",
              opacity: 0,
              cursor: "crosshair",
            }}
          />
          <Handle
            id="right"
            type="source"
            position={Position.Right}
            isConnectable={true}
            style={{
              width: "8px",
              height: "100%",
              background: "transparent",
              border: "none",
              opacity: 0,
              cursor: "crosshair",
            }}
          />
          <Handle
            id="bottom"
            type="source"
            position={Position.Bottom}
            isConnectable={true}
            style={{
              width: "100%",
              height: "8px",
              background: "transparent",
              border: "none",
              opacity: 0,
              cursor: "crosshair",
            }}
          />
          <Handle
            id="left"
            type="source"
            position={Position.Left}
            isConnectable={true}
            style={{
              width: "8px",
              height: "100%",
              background: "transparent",
              border: "none",
              opacity: 0,
              cursor: "crosshair",
            }}
          />

          {/* Table Header */}
          <div
            className="relative bg-[var(--brand)] text-[var(--bg)] px-3 py-2 font-semibold flex items-center justify-between flex-shrink-0 rounded-t-md"
            style={{
              ...(backgroundColor
                ? { backgroundColor: borderColor || backgroundColor }
                : { backgroundColor: borderColor || "var(--brand)" }),
              ...(textColor ? { color: textColor } : { color: "var(--bg)" }),
            }}
          >
            <div className="min-w-0 flex flex-1 items-center gap-2 px-1 py-0.5">
              {Icon ? (
                <Icon size={16} aria-hidden="true" />
              ) : (
                typeof data.icon === "string" && (
                  <span className="text-lg">{data.icon}</span>
                )
              )}
              <div className="min-w-0">
                <div className="truncate">{displayLabel}</div>
                {subtitle && (
                  <div className="text-[11px] font-normal opacity-80 truncate">
                    {subtitle}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCollapseToggle}
              className="nodrag nopan flex-shrink-0 rounded p-1 hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-expanded={!isCollapsed}
              aria-controls={tableContentId}
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${displayLabel}`}
              data-tooltip={isCollapsed ? "Expand table" : "Collapse table"}
              data-tooltip-placement="top"
            >
              <MdExpandMore
                aria-hidden="true"
                className={`h-5 w-5 flex-shrink-0 transition-transform duration-150 ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
              />
            </button>
            <button
              type="button"
              onClick={onToggle}
              className="nodrag nopan flex-shrink-0 rounded p-1 hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label="Open table properties"
              data-tooltip="Open table properties"
            >
              <MdSettings className="w-4 h-4" />
            </button>
            {isCollapsed && isERTable && attributes.length > 0 && (
              <div
                className="pointer-events-none absolute inset-0 z-20"
                aria-label="Collapsed entity attribute connection ports"
              >
                {attributes.map((attribute) => (
                  <FieldConnectionHandles
                    key={attribute.id}
                    fieldId={attribute.id}
                    label={attribute.name || "attribute"}
                    top="50%"
                    showIcon={isHovered}
                  />
                ))}
              </div>
            )}
          </div>

          <div
            id={tableContentId}
            className={isCollapsed ? "hidden" : "contents"}
          >
            {!isCollapsed && (
              <>
                {/* Column Headers */}
                <div
                  className="bg-[var(--bg-hover)] px-3 py-1 border-b border-theme/20 flex items-center gap-2 text-xs font-semibold flex-shrink-0"
                  style={{
                    ...(backgroundColor ? { backgroundColor } : {}),
                    ...(borderColor ? { borderBottomColor: borderColor } : {}),
                    ...(textColor ? { color: textColor } : {}),
                  }}
                >
                  <span className="w-5 flex-shrink-0" aria-hidden="true" />
                  {columns.map((col) => (
                    <span
                      key={col.key}
                      className={col.width || "flex-1"}
                      style={{
                        textAlign:
                          col.align ||
                          (col.type === "boolean" ? "center" : "left"),
                      }}
                    >
                      {col.label}
                    </span>
                  ))}
                </div>

                {/* Attributes List */}
                <div
                  ref={attributeScrollRef}
                  onScroll={updateAttributePortPositions}
                  className={`divide-y divide-theme/10 ${
                    isContentSizedTable
                      ? "overflow-visible"
                      : "min-h-0 flex-1 overflow-y-auto table-node-scroll"
                  }`}
                >
                  {attributes.map((attr) => {
                    const isEditing = editingAttrId === attr.id;
                    const rowReorderProps = rowReordering.getRowProps(attr.id);
                    const dragHandleProps = rowReordering.getHandleProps(
                      attr.id,
                      attr.name,
                    );
                    return (
                      <div
                        key={attr.id}
                        ref={(row) => {
                          if (row) {
                            attributeRowRefs.current.set(attr.id, row);
                          } else {
                            attributeRowRefs.current.delete(attr.id);
                          }
                        }}
                        className={`group flex items-center gap-2 px-3 py-2 transition-colors ${
                          entityRowHoverBackground
                            ? "hover:bg-[var(--entity-row-hover)] focus-visible:bg-[var(--entity-row-hover)]"
                            : "hover:bg-[var(--bg-hover)]"
                        }`}
                        {...rowReorderProps}
                        style={
                          {
                            ...(entityRowHoverBackground
                              ? {
                                  "--entity-row-hover":
                                    entityRowHoverBackground,
                                }
                              : {}),
                            ...rowReorderProps.style,
                          } as React.CSSProperties
                        }
                        role="group"
                        aria-label={
                          attr.name ? `Attribute ${attr.name}` : "Attribute row"
                        }
                        onBlur={
                          isEditing
                            ? (e: React.FocusEvent<HTMLDivElement>) => {
                                if (
                                  !e.currentTarget.contains(
                                    e.relatedTarget as Node,
                                  )
                                ) {
                                  handleSaveEdit();
                                }
                              }
                            : undefined
                        }
                      >
                        <button
                          {...dragHandleProps}
                          disabled={isEditing}
                          className={`${dragHandleProps.className} ${isEditing ? "invisible" : ""}`}
                        >
                          <MdDragIndicator
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </button>
                        {columns.map((col) =>
                          renderTableColumnCell({
                            col,
                            attr,
                            isEditing,
                            editingValue,
                            editingInputRef,
                            textColor,
                            onToggleBoolean: handleToggleBoolean,
                            onChangeValue: setEditingValue,
                            onStartEdit: handleStartEdit,
                            onSaveEdit: handleSaveEdit,
                            onCancelEdit: handleCancelEdit,
                            onDeleteAttribute: handleDeleteAttribute,
                          }),
                        )}
                      </div>
                    );
                  })}
                </div>

                {isERTable && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20"
                    aria-label="Entity attribute connection ports"
                    style={{
                      top: `${attributePortLayer.top}px`,
                      height: `${attributePortLayer.height}px`,
                    }}
                  >
                    {attributePortPositions.map((position) => {
                      const attribute = attributes.find(
                        (attr) => attr.id === position.id,
                      );
                      return (
                        <FieldConnectionHandles
                          key={position.id}
                          fieldId={position.id}
                          label={attribute?.name || "attribute"}
                          top={position.top}
                          visible={position.visible}
                          showIcon={isHovered}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Empty state */}
                {attributes.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-muted">
                    Click + to add attributes
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-1 px-2 py-1 bg-[var(--bg-hover)] border-t border-theme nodrag rounded-b-md">
            <button
              type="button"
              className="p-1 text-muted hover:text-theme"
              aria-label="Add attribute"
              data-tooltip="Add attribute"
              onClick={handleAddAttribute}
            >
              <MdAdd className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1 text-muted hover:text-theme"
              aria-label={`Duplicate ${actionLabel}`}
              data-tooltip={`Duplicate ${actionLabel}`}
              data-tooltip-placement="top"
              onClick={handleCopy}
            >
              <IoDuplicateOutline className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1 text-muted transition-colors hover:!text-red-600 focus-visible:!text-red-600"
              aria-label={`Double-click to delete ${actionLabel}`}
              data-tooltip={`Double-click to delete ${actionLabel}`}
              data-tooltip-placement="top"
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={onDelete}
            >
              <MdDelete className="w-4 h-4 transition-colors" />
            </button>
          </div>
        </motion.div>

        {/* Context Menu Portal */}
        {contextMenu.visible &&
          ReactDOM.createPortal(
            <motion.div
              data-context-menu
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="fixed z-[10000] bg-[var(--surface)] border border-theme rounded-lg shadow-lg py-1 min-w-[140px] pointer-events-auto"
              style={{
                left: contextMenu.x,
                top: contextMenu.y,
                transform: "translate(-50%, -10px)",
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(e);
                  closeContextMenu();
                }}
                className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-sm"
              >
                <MdSettings className="w-4 h-4" />
                Settings
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  globalThis.dispatchEvent(
                    new CustomEvent("diagram:node-to-front", {
                      detail: { id },
                    }),
                  );
                  closeContextMenu();
                }}
                className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-sm"
              >
                <MdOutlineVerticalAlignTop className="w-4 h-4" />
                Bring to Front
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  globalThis.dispatchEvent(
                    new CustomEvent("diagram:node-to-back", { detail: { id } }),
                  );
                  closeContextMenu();
                }}
                className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-sm"
              >
                <MdOutlineVerticalAlignBottom className="w-4 h-4" />
                Send to Back
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddAttribute(e);
                  closeContextMenu();
                }}
                className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-sm"
              >
                <MdAdd className="w-4 h-4" />
                Add Attribute
              </button>
              {isInGroup && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDetach(e);
                    closeContextMenu();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-sm text-orange-500"
                >
                  <FiUnlock className="w-4 h-4" />
                  Detach from Group
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(e);
                  closeContextMenu();
                }}
                className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-sm"
              >
                <IoDuplicateOutline className="w-4 h-4" />
                Duplicate
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onDelete(e);
                  closeContextMenu();
                }}
                aria-label={`Double-click to delete ${actionLabel}`}
                title={`Double-click to delete ${actionLabel}`}
                className="w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-sm text-red-600"
              >
                <MdDelete className="w-4 h-4" />
                Double-click to delete {actionLabel}
              </button>
            </motion.div>,
            document.body,
          )}
      </>
    );
  },
);

TableNode.displayName = "TableNode";

export default TableNode;
