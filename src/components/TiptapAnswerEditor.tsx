import React, { useEffect, useState, useReducer } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import {
  MdCode,
  MdFormatAlignCenter,
  MdFormatAlignLeft,
  MdFormatAlignRight,
  MdFormatBold,
  MdFormatItalic,
  MdFormatListBulleted,
  MdFormatListNumbered,
  MdFormatQuote,
  MdFormatUnderlined,
  MdFullscreen,
  MdFullscreenExit,
  MdMic,
  MdStrikethroughS,
  MdClose,
  MdStop,
} from "react-icons/md";
import MicLevelVisualizer from "./shared/MicLevelVisualizer";
import { useAudioTranscription } from "./shared/useAudioTranscription";

type TiptapAnswerEditorProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  contentFormat?: "text" | "html";
  ariaLabel?: string;
  maxLength?: number;
  onHtmlChange?: (html: string, text: string) => void;
};

type ToolbarButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title: string;
  children: React.ReactNode;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "<br />");

const toEditorContent = (
  value: string,
  contentFormat: "text" | "html",
): string => {
  if (!value.trim()) return "";
  return contentFormat === "html" ? value : `<p>${escapeHtml(value)}</p>`;
};

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  disabled,
  active,
  title,
  children,
}) => (
  <button
    type="button"
    aria-label={title}
    data-tooltip={title}
    disabled={disabled}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    className={`rounded px-2 py-1 text-theme transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50 ${active ? "bg-[var(--brand)] text-[var(--bg)]" : ""}`}
  >
    {children}
  </button>
);

const HeadingSelect: React.FC<{
  editor: Editor;
  disabled?: boolean;
}> = ({ editor, disabled }) => {
  let headingValue = "0";

  if (editor.isActive("heading", { level: 1 })) {
    headingValue = "1";
  } else if (editor.isActive("heading", { level: 2 })) {
    headingValue = "2";
  } else if (editor.isActive("heading", { level: 3 })) {
    headingValue = "3";
  }

  return (
    <select
      aria-label="Paragraph style"
      data-tooltip="Paragraph style"
      value={headingValue}
      disabled={disabled}
      onChange={(event) => {
        const level = Number(event.target.value);
        if (level === 0) {
          editor.chain().focus().setParagraph().run();
        } else {
          editor
            .chain()
            .focus()
            .toggleHeading({ level: level as 1 | 2 | 3 })
            .run();
        }
      }}
      className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-theme disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="0">P</option>
      <option value="1">H1</option>
      <option value="2">H2</option>
      <option value="3">H3</option>
    </select>
  );
};

const TiptapAnswerEditor: React.FC<TiptapAnswerEditorProps> = ({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  contentFormat = "text",
  ariaLabel = id,
  maxLength,
  onHtmlChange,
}) => {
  const [, forceUpdate] = useReducer((revision: number) => revision + 1, 0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: toEditorContent(value, contentFormat),
    editable: !disabled,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (currentEditor.isDestroyed || !currentEditor.schema) return;
      const text = currentEditor.getText({ blockSeparator: "\n" });
      if (maxLength !== undefined && text.length > maxLength) {
        currentEditor.commands.undo();
        return;
      }
      onChange(text);
      onHtmlChange?.(currentEditor.getHTML(), text);
    },
    onSelectionUpdate: () => forceUpdate(),
    onTransaction: () => forceUpdate(),
  });

  useEffect(() => {
    // StrictMode can replay this effect after Tiptap has cleared the schema.
    if (!editor || editor.isDestroyed || !editor.schema) return;

    const editorText = editor.getText({ blockSeparator: "\n" });
    if (contentFormat === "html") {
      if (value.trim() && editor.getHTML() !== value) {
        editor.commands.setContent(toEditorContent(value, contentFormat), {
          emitUpdate: false,
        });
      } else if (!value.trim() && editorText.trim()) {
        editor.commands.clearContent(false);
      }
    } else if (editorText !== value) {
      editor.commands.setContent(toEditorContent(value, contentFormat), {
        emitUpdate: false,
      });
    }
    editor.setEditable(!disabled);
  }, [contentFormat, disabled, editor, value]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  const {
    isRecording,
    isTranscribing,
    error: transcriptionError,
    micAnalyser,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioTranscription({
    onTranscript: (text) => {
      if (!editor || editor.isDestroyed || !editor.schema) return;
      editor.chain().focus().insertContent(text).run();
    },
  });

  const isRecordingOrTranscribing = isRecording || isTranscribing;

  if (!editor || !editor.schema) return null;

  const inlineButtons = [
    {
      key: "bold",
      title: "Bold",
      onClick: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive("bold"),
      node: <MdFormatBold size={16} aria-hidden />,
    },
    {
      key: "italic",
      title: "Italic",
      onClick: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive("italic"),
      node: <MdFormatItalic size={16} aria-hidden />,
    },
    {
      key: "underline",
      title: "Underline",
      onClick: () => editor.chain().focus().toggleUnderline().run(),
      active: editor.isActive("underline"),
      node: <MdFormatUnderlined size={16} aria-hidden />,
    },
    {
      key: "strike",
      title: "Strikethrough",
      onClick: () => editor.chain().focus().toggleStrike().run(),
      active: editor.isActive("strike"),
      node: <MdStrikethroughS size={16} aria-hidden />,
    },
    {
      key: "bulletList",
      title: "Bulleted list",
      onClick: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive("bulletList"),
      node: <MdFormatListBulleted size={16} aria-hidden />,
    },
    {
      key: "orderedList",
      title: "Numbered list",
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive("orderedList"),
      node: <MdFormatListNumbered size={16} aria-hidden />,
    },
    {
      key: "blockquote",
      title: "Quote",
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive("blockquote"),
      node: <MdFormatQuote size={16} aria-hidden />,
    },
    {
      key: "codeBlock",
      title: "Code block",
      onClick: () => editor.chain().focus().toggleCodeBlock().run(),
      active: editor.isActive("codeBlock"),
      node: <MdCode size={16} aria-hidden />,
    },
  ];

  const alignmentButtons = [
    {
      key: "align-left",
      title: "Align left",
      onClick: () => editor.chain().focus().setTextAlign("left").run(),
      active: editor.isActive({ textAlign: "left" }),
      node: <MdFormatAlignLeft size={16} aria-hidden />,
    },
    {
      key: "align-center",
      title: "Align center",
      onClick: () => editor.chain().focus().setTextAlign("center").run(),
      active: editor.isActive({ textAlign: "center" }),
      node: <MdFormatAlignCenter size={16} aria-hidden />,
    },
    {
      key: "align-right",
      title: "Align right",
      onClick: () => editor.chain().focus().setTextAlign("right").run(),
      active: editor.isActive({ textAlign: "right" }),
      node: <MdFormatAlignRight size={16} aria-hidden />,
    },
  ];

  const recordingBar = (
    <div className="flex min-w-0 flex-1 items-center gap-2 py-0.5">
      <ToolbarButton
        onClick={cancelRecording}
        disabled={isTranscribing}
        title="Cancel recording"
      >
        <MdClose size={16} aria-hidden />
      </ToolbarButton>
      <div className="min-w-0 flex-1">
        {isRecording ? (
          <MicLevelVisualizer analyser={micAnalyser} active={isRecording} />
        ) : (
          <span className="px-1 text-xs text-muted">Transcribing…</span>
        )}
      </div>
      {isRecording && (
        <ToolbarButton
          onClick={stopRecording}
          active
          title="Stop and transcribe"
        >
          <MdStop size={16} aria-hidden />
        </ToolbarButton>
      )}
    </div>
  );

  const renderToolbar = () => (
    <div className="flex flex-wrap items-center gap-1 border-b border-theme/10 p-1 text-sm">
      {isRecordingOrTranscribing ? (
        recordingBar
      ) : (
        <>
          <HeadingSelect editor={editor} disabled={disabled} />
          {inlineButtons.map((button) => (
            <ToolbarButton
              key={button.key}
              onClick={button.onClick}
              disabled={disabled}
              active={button.active}
              title={button.title}
            >
              {button.node}
            </ToolbarButton>
          ))}
          {alignmentButtons.map((button) => (
            <ToolbarButton
              key={button.key}
              onClick={button.onClick}
              disabled={disabled}
              active={button.active}
              title={button.title}
            >
              {button.node}
            </ToolbarButton>
          ))}
          <hr
            aria-orientation="vertical"
            className="mx-1 h-6 w-px border-0 bg-[var(--border)]"
          />
          <ToolbarButton
            onClick={startRecording}
            disabled={disabled}
            title="Record voice input"
          >
            <MdMic size={16} aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setIsFullscreen((fullscreen) => !fullscreen)}
            disabled={disabled}
            active={isFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <MdFullscreenExit size={16} aria-hidden />
            ) : (
              <MdFullscreen size={16} aria-hidden />
            )}
          </ToolbarButton>
        </>
      )}
    </div>
  );

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-[var(--bg)] p-4"
          : ""
      }
    >
      <div
        className={`overflow-hidden rounded-lg border border-theme bg-theme text-theme transition-colors focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--brand)]/30 ${isFullscreen ? "flex h-full flex-col" : ""} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        {renderToolbar()}
        {transcriptionError && (
          <div className="px-2 pt-1 text-xs text-red-500">
            {transcriptionError}
          </div>
        )}
        <div
          id={id}
          className={
            isFullscreen
              ? "min-h-0 flex-1 overflow-y-auto p-4 text-xs leading-relaxed"
              : "min-h-[9rem] px-3 py-2.5 text-xs leading-relaxed"
          }
        >
          <EditorContent editor={editor} className="tiptap-answer-editor" />
        </div>
      </div>
    </div>
  );
};

export default TiptapAnswerEditor;
