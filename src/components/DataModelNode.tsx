import React, { useMemo, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { motion } from "framer-motion";
import { MdAdd, MdDelete, MdExpandMore, MdSettings } from "react-icons/md";
import { IoDuplicateOutline } from "react-icons/io5";
import type { DataModelField, DataModelNodeData } from "../types/canvas";
import {
  getDefaultDataModelFields,
  parseDataModelFields,
} from "../utils/dataModel";

type Props = {
  id: string;
  data: DataModelNodeData;
  onCopy?: (id: string, data: DataModelNodeData) => void;
  isInGroup?: boolean;
};

const getFieldIndent = (field: DataModelField) => {
  if (field.parentId) return 1;
  return Math.max(0, field.name.split(".").length - 1);
};

const getFieldRole = (field: DataModelField) => {
  if (field.keyRole === "partition") return "Partition";
  if (field.keyRole === "sort") return "Sort";
  if (field.keyRole === "secondary") return "Index";
  return field.indexed ? "Indexed" : "";
};

const DataModelNode: React.FC<Props> = React.memo(
  ({ id, data, onCopy, isInGroup }) => {
    const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState({ name: "", type: "" });
    const fields = useMemo(
      () => parseDataModelFields(data.fields),
      [data.fields],
    );
    const isCollapsed = data.isCollapsed === true;
    const Icon = data.icon as React.ComponentType<{
      size?: number;
      "aria-hidden"?: React.AriaAttributes["aria-hidden"];
    }>;

    const emit = (name: string, detail: Record<string, unknown>) => {
      globalThis.dispatchEvent(new CustomEvent(name, { detail }));
    };

    const saveField = () => {
      if (!editingFieldId) return;
      emit("diagram:data-model-field-update", {
        nodeId: id,
        fieldId: editingFieldId,
        name: editingValue.name,
        type: editingValue.type,
      });
      setEditingFieldId(null);
    };

    const startEditing = (field: DataModelField) => {
      setEditingFieldId(field.id);
      setEditingValue({ name: field.name, type: field.type });
    };

    const handleAddField = (event: React.MouseEvent) => {
      event.stopPropagation();
      const defaultField = getDefaultDataModelFields(data.dataModel.kind).at(
        -1,
      ) ?? {
        id: "field",
        name: "new_field",
        type: "String",
      };
      emit("diagram:data-model-field-add", {
        nodeId: id,
        field: { ...defaultField, id: `field-${Date.now()}` },
      });
    };

    return (
      <motion.div
        initial={{ y: 0, opacity: 1 }}
        whileHover={{ y: -1, boxShadow: "0 12px 30px rgba(0,0,0,0.12)" }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className={`min-w-[270px] max-w-[430px] bg-surface border-2 border-theme text-theme text-sm shadow-lg cursor-grab relative rounded-lg overflow-visible flex flex-col ${
          isInGroup ? "opacity-95" : ""
        }`}
      >
        <Handle
          id="top"
          type="source"
          position={Position.Top}
          className="!w-full !h-2 !bg-transparent !border-0 !opacity-0"
        />
        <Handle
          id="right"
          type="source"
          position={Position.Right}
          className="!w-2 !h-full !bg-transparent !border-0 !opacity-0"
        />
        <Handle
          id="bottom"
          type="source"
          position={Position.Bottom}
          className="!w-full !h-2 !bg-transparent !border-0 !opacity-0"
        />
        <Handle
          id="left"
          type="source"
          position={Position.Left}
          className="!w-2 !h-full !bg-transparent !border-0 !opacity-0"
        />

        <div className="bg-[var(--brand)] text-[var(--bg)] px-3 py-2 font-semibold flex items-center gap-2 nodrag">
          {Icon && <Icon size={16} aria-hidden="true" />}
          <div className="min-w-0 flex-1">
            <div className="truncate">{data.componentName || data.label}</div>
            {data.subtitle && (
              <div className="text-[11px] font-normal opacity-80 truncate">
                {data.subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            className="nodrag p-1 rounded hover:bg-white/10"
            aria-label={
              isCollapsed ? "Expand data model" : "Collapse data model"
            }
            onClick={(event) => {
              event.stopPropagation();
              emit("diagram:table-collapse-toggle", { id });
            }}
          >
            <MdExpandMore
              size={18}
              className={isCollapsed ? "-rotate-90" : ""}
            />
          </button>
          <button
            type="button"
            className="nodrag p-1 rounded hover:bg-white/10"
            aria-label="Add data model field"
            onClick={handleAddField}
          >
            <MdAdd size={18} />
          </button>
          <button
            type="button"
            className="nodrag p-1 rounded hover:bg-white/10"
            aria-label="Open data model properties"
            onClick={(event) => {
              event.stopPropagation();
              emit("diagram:node-toggle", { id });
            }}
          >
            <MdSettings size={16} />
          </button>
        </div>

        {!isCollapsed && (
          <div className="bg-surface overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(90px,0.8fr)_72px] gap-2 px-3 py-1.5 bg-[var(--bg-hover)] border-b border-theme text-[11px] font-semibold text-muted">
              <span>Field</span>
              <span>Type</span>
              <span>Role</span>
            </div>
            {fields.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted">
                Add a field to define this model.
              </div>
            ) : (
              fields.map((field) => {
                const isEditing = editingFieldId === field.id;
                const indent = getFieldIndent(field);
                return (
                  <div
                    key={field.id}
                    className="group grid grid-cols-[minmax(0,1fr)_minmax(90px,0.8fr)_72px] gap-2 items-center px-3 py-1.5 border-b border-theme/70 last:border-b-0"
                  >
                    {isEditing ? (
                      <input
                        className="nodrag min-w-0 w-full px-1 py-0.5 bg-surface border border-theme rounded text-xs"
                        value={editingValue.name}
                        aria-label="Field name"
                        onChange={(event) =>
                          setEditingValue((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        onBlur={saveField}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveField();
                          if (event.key === "Escape") setEditingFieldId(null);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="nodrag min-w-0 truncate text-left hover:text-[var(--brand)]"
                        style={{ paddingLeft: `${indent * 12}px` }}
                        onDoubleClick={() => startEditing(field)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            startEditing(field);
                          }
                        }}
                        aria-label={`Edit ${field.name}`}
                      >
                        {field.name}
                      </button>
                    )}
                    {isEditing ? (
                      <input
                        className="nodrag min-w-0 w-full px-1 py-0.5 bg-surface border border-theme rounded text-xs"
                        value={editingValue.type}
                        aria-label="Field type"
                        onChange={(event) =>
                          setEditingValue((current) => ({
                            ...current,
                            type: event.target.value,
                          }))
                        }
                        onBlur={saveField}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveField();
                          if (event.key === "Escape") setEditingFieldId(null);
                        }}
                      />
                    ) : (
                      <span className="truncate text-muted">{field.type}</span>
                    )}
                    <div className="flex items-center justify-between gap-1 text-[10px] text-muted">
                      <button
                        type="button"
                        className="nodrag truncate hover:text-theme"
                        aria-label={`Toggle ${field.name} role`}
                        onClick={() =>
                          emit("diagram:data-model-field-toggle", {
                            nodeId: id,
                            fieldId: field.id,
                            key: field.keyRole ? "keyRole" : "indexed",
                          })
                        }
                      >
                        {getFieldRole(field) ||
                          (field.required ? "Required" : "")}
                      </button>
                      <button
                        type="button"
                        className="nodrag opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700"
                        aria-label={`Delete ${field.name}`}
                        onClick={() =>
                          emit("diagram:data-model-field-delete", {
                            nodeId: id,
                            fieldId: field.id,
                          })
                        }
                      >
                        <MdDelete size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-1 px-2 py-1 bg-[var(--bg-hover)] border-t border-theme nodrag">
          <button
            type="button"
            className="p-1 text-muted hover:text-theme"
            aria-label="Duplicate data model"
            onClick={(event) => {
              event.stopPropagation();
              onCopy?.(id, data);
            }}
          >
            <IoDuplicateOutline size={14} />
          </button>
          <button
            type="button"
            className="p-1 text-muted hover:text-red-600"
            aria-label="Delete data model"
            onClick={(event) => {
              event.stopPropagation();
              emit("diagram:node-delete", { id });
            }}
          >
            <MdDelete size={14} />
          </button>
        </div>
      </motion.div>
    );
  },
);

DataModelNode.displayName = "DataModelNode";

export default DataModelNode;
