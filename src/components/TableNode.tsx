import React, { useState, useCallback } from "react";
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

const TableNode: React.FC<Props> = React.memo(
  ({ id, data, onCopy, isInGroup }) => {
    const [contextMenu, setContextMenu] = useState<{
      visible: boolean;
      x: number;
      y: number;
    }>({ visible: false, x: 0, y: 0 });

    const [editingAttrId, setEditingAttrId] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState({ name: "", type: "" });
    const [isHovered, setIsHovered] = useState(false);
    const updateNodeInternals = useUpdateNodeInternals();
    const attributeScrollRef = React.useRef<HTMLDivElement | null>(null);
    const attributeRowRefs = React.useRef(new Map<string, HTMLDivElement>());
    const [attributePortPositions, setAttributePortPositions] = useState<
      Array<{ id: string; top: number; visible: boolean }>
    >([]);
    const [attributePortLayer, setAttributePortLayer] = useState({
      top: 0,
      height: 0,
    });

    const displayLabel = data.componentName || data.label;
    const actionLabel =
      data.componentId === "weak-entity"
        ? "Weak Entity"
        : data.componentId === "entity" || data.componentId === "er-entity"
          ? "Entity"
          : data.componentId === "er-view"
            ? "View"
            : displayLabel || "Table";
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
    const attributes = React.useMemo(() => {
      if (!data.attributes) return [];
      if (Array.isArray(data.attributes)) return data.attributes;
      if (typeof data.attributes === "string") {
        try {
          const parsed = JSON.parse(data.attributes);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    }, [data.attributes]);

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

    const updateAttributePortPositions = useCallback(() => {
      const scrollElement = attributeScrollRef.current;
      if (!scrollElement) return;

      const viewportHeight = scrollElement.clientHeight;
      setAttributePortLayer({
        top: scrollElement.offsetTop,
        height: viewportHeight,
      });
      const nextPositions = attributes.map((attribute) => {
        const row = attributeRowRefs.current.get(attribute.id);
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

      setAttributePortPositions(
        nextPositions.filter(
          (position): position is NonNullable<typeof position> =>
            position !== null,
        ),
      );
    }, [attributes]);

    React.useLayoutEffect(() => {
      updateAttributePortPositions();

      const scrollElement = attributeScrollRef.current;
      if (!scrollElement || typeof ResizeObserver === "undefined") return;

      const observer = new ResizeObserver(updateAttributePortPositions);
      observer.observe(scrollElement);
      return () => observer.disconnect();
    }, [editingAttrId, updateAttributePortPositions]);

    React.useLayoutEffect(() => {
      updateNodeInternals(id);
    }, [attributePortPositions, id, isCollapsed, updateNodeInternals]);

    // Get column configuration from renderConfig or use defaults
    const columns = React.useMemo<TableColumn[]>(() => {
      if (data.renderConfig?.columns && data.renderConfig.columns.length > 0) {
        return data.renderConfig.columns;
      }
      // Default columns for database table
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
    }, [data.renderConfig]);

    const onDelete = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        globalThis.dispatchEvent(
          new CustomEvent("diagram:node-delete", { detail: { id } }),
        );
      },
      [id],
    );

    const onToggle = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        globalThis.dispatchEvent(
          new CustomEvent("diagram:node-toggle", { detail: { id } }),
        );
      },
      [id],
    );

    const handleCollapseToggle = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        globalThis.dispatchEvent(
          new CustomEvent("diagram:table-collapse-toggle", {
            detail: { id },
          }),
        );
      },
      [id],
    );

    const handleCopy = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onCopy?.(id, data);
      },
      [id, data, onCopy],
    );

    const handleDetach = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        globalThis.dispatchEvent(
          new CustomEvent("diagram:node-detach", { detail: { id } }),
        );
      },
      [id],
    );

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
      });
    }, []);

    const closeContextMenu = useCallback(() => {
      setContextMenu({ visible: false, x: 0, y: 0 });
    }, []);

    const handleDeleteAttribute = useCallback(
      (attrId: string) => {
        globalThis.dispatchEvent(
          new CustomEvent("diagram:table-attribute-delete", {
            detail: { nodeId: id, attributeId: attrId },
          }),
        );
      },
      [id],
    );

    // Add new attribute
    const handleAddAttribute = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();

        // Determine if this is a UML Class or Entity based on componentId
        const isUMLClass = data.componentId?.startsWith("uml-");

        const newAttr: TableAttribute = isUMLClass
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
            detail: { nodeId: id, attribute: newAttr },
          }),
        );
      },
      [id, data.componentId],
    );

    // Start editing attribute
    const handleStartEdit = useCallback(
      (attr: TableAttribute, e: React.SyntheticEvent) => {
        e.stopPropagation();
        setEditingAttrId(attr.id);
        setEditingValue({ name: attr.name, type: attr.type });
      },
      [],
    );

    // Save attribute edit
    const handleSaveEdit = useCallback(() => {
      if (editingAttrId) {
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
      }
    }, [id, editingAttrId, editingValue]);

    // Cancel edit
    const handleCancelEdit = useCallback(() => {
      setEditingAttrId(null);
    }, []);

    // Generic toggle handler for boolean columns
    const handleToggleBoolean = useCallback(
      (attrId: string, key: string) => {
        globalThis.dispatchEvent(
          new CustomEvent("diagram:table-attribute-toggle", {
            detail: { nodeId: id, attributeId: attrId, key },
          }),
        );
      },
      [id],
    );

    // Render individual column cell based on column configuration
    const renderColumnCell = useCallback(
      (col: (typeof columns)[0], attr: TableAttribute, isEditing: boolean) => {
        const cellClassName = col.width || "flex-1";
        const attrValue = attr[col.key as keyof TableAttribute];

        // Boolean type - render as toggle button
        if (col.type === "boolean") {
          const boolValue = Boolean(attrValue);
          // For isNullable, we invert the logic (unchecked = nullable, checked = NOT NULL)
          const isInverted = col.key === "isNullable";
          const displayValue = isInverted ? !boolValue : boolValue;
          const icon = displayValue ? col.icon?.active : col.icon?.inactive;
          const colorClass = displayValue
            ? col.color?.active
            : col.color?.inactive;

          return (
            <button
              key={col.key}
              type="button"
              onClick={() => handleToggleBoolean(attr.id, col.key)}
              className={`${cellClassName} flex items-center justify-center ${colorClass || ""}`}
              aria-label={col.label}
              data-tooltip={col.label}
              aria-pressed={displayValue}
            >
              {
                <BooleanCellContent
                  columnKey={col.key}
                  displayValue={displayValue}
                  icon={icon}
                />
              }
            </button>
          );
        }

        // Text type - editable field
        if (col.type === "text" && col.editable) {
          if (isEditing) {
            return (
              <input
                key={col.key}
                type="text"
                value={String(
                  editingValue[col.key as keyof typeof editingValue] ??
                    attrValue ??
                    "",
                )}
                onChange={(e) =>
                  setEditingValue({
                    ...editingValue,
                    [col.key]: e.target.value,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                className={`${cellClassName} px-1 py-0.5 bg-surface border border-theme/40 rounded text-xs`}
                autoFocus={col.key === "name"}
                onClick={(e) => e.stopPropagation()}
              />
            );
          }

          // Determine color based on attribute properties
          let textColorClass = "text-xs cursor-pointer";
          if (col.key === "name") {
            if (attr.isPrimaryKey) {
              textColorClass +=
                " font-semibold text-yellow-600 dark:text-yellow-400";
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
              onDoubleClick={(e) => handleStartEdit(attr, e)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleStartEdit(attr, e);
                }
              }}
              data-tooltip="Double-click or press Enter to edit"
            >
              {String(attrValue || "")}
            </button>
          );
        }

        // Readonly type - actions column
        if (col.type === "readonly" && col.key === "actions") {
          if (isEditing) {
            return (
              <button
                key="actions"
                type="button"
                onClick={handleSaveEdit}
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
              onClick={() => handleDeleteAttribute(attr.id)}
              className={`${cellClassName} opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700 transition-opacity`}
              aria-label="Delete attribute"
              data-tooltip="Delete attribute"
            >
              <MdDelete className="w-3 h-3" />
            </button>
          );
        }

        // Default fallback
        return (
          <span key={col.key} className={cellClassName}>
            {String(attrValue || "")}
          </span>
        );
      },
      [
        handleToggleBoolean,
        handleDeleteAttribute,
        handleStartEdit,
        handleSaveEdit,
        handleCancelEdit,
        editingValue,
        textColor,
      ],
    );

    React.useEffect(() => {
      if (contextMenu.visible) {
        const handleClick = (e: MouseEvent) => {
          const menu = document.querySelector("[data-context-menu]");
          if (menu && !menu.contains(e.target as Node)) {
            closeContextMenu();
          }
        };
        document.addEventListener("click", handleClick);
        document.addEventListener("contextmenu", handleClick);
        return () => {
          document.removeEventListener("click", handleClick);
          document.removeEventListener("contextmenu", handleClick);
        };
      }
    }, [contextMenu.visible, closeContextMenu]);

    return (
      <>
        <motion.div
          initial={{ y: 0, opacity: 1 }}
          whileHover={{ y: -1, boxShadow: "0 12px 30px rgba(0,0,0,0.12)" }}
          whileTap={{ scale: 0.985 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className={`min-w-[220px] ${isContentSizedTable ? "w-[360px] min-w-[360px] max-w-[360px]" : "max-h-[500px]"} bg-surface border-2 border-theme text-theme text-sm shadow-lg cursor-grab relative rounded-lg overflow-visible flex flex-col`}
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
                        tabIndex={0}
                        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                          // Only trigger when the div itself is the event target (not when typing in inputs)
                          if (
                            e.target === e.currentTarget &&
                            !isEditing &&
                            (e.key === "Enter" || e.key === " ")
                          ) {
                            e.preventDefault();
                            handleStartEdit(
                              attr,
                              e as unknown as React.SyntheticEvent,
                            );
                          }
                        }}
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
                          renderColumnCell(col, attr, isEditing),
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
