import type { EffectCallback, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Editor } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnimatedTextarea from "./AnimatedTextarea";
import TiptapAnswerEditor from "../TiptapAnswerEditor";

type EditorFixture = ReturnType<typeof createEditor>;
type Harness = {
  editor: EditorFixture | null;
  effects: EffectCallback[];
  callbacks: { onUpdate?: (event: { editor: EditorFixture }) => void };
  onTranscript?: (text: string) => void;
};
const harness = vi.hoisted(() => {
  const state: Harness = { editor: null, effects: [], callbacks: {} };
  return state;
});

// Capture the actual component effect and replay it after Tiptap tears down
// the editor, as happens during React's StrictMode effect replay.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: EffectCallback) => harness.effects.push(effect),
  };
});
vi.mock("@tiptap/react", () => ({
  useEditor: (options: Harness["callbacks"]) => {
    harness.callbacks = options;
    return harness.editor;
  },
  EditorContent: () => <div data-editor-content="true" />,
}));
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
}));
vi.mock("./AnimatedFieldBase", () => ({
  FieldWrapper: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("./MicLevelVisualizer", () => ({ default: () => null }));
vi.mock("./useAudioTranscription", () => ({
  useAudioTranscription: ({
    onTranscript,
  }: {
    onTranscript: (text: string) => void;
  }) => {
    harness.onTranscript = onTranscript;
    return {
      isRecording: false,
      isTranscribing: false,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      cancelRecording: vi.fn(),
    };
  },
}));

function createEditor() {
  const lifecycle: { destroyed: boolean; schema: object | null } = {
    destroyed: false,
    schema: {},
  };
  type Chain = {
    focus: () => Chain;
    insertContent: () => Chain;
    run: () => void;
  };
  const chain: Chain = {
    focus: vi.fn(() => chain),
    insertContent: vi.fn(() => chain),
    run: vi.fn(),
  };
  const editor = {
    get isDestroyed() {
      return lifecycle.destroyed;
    },
    get schema() {
      return lifecycle.schema;
    },
    state: { doc: { content: Fragment.empty } },
    getHTML: vi.fn<() => string>((): string =>
      lifecycle.schema
        ? "<p>Current</p>"
        : Reflect.apply(Editor.prototype.getHTML, editor, []),
    ),
    getText: vi.fn(() => "Current"),
    isActive: vi.fn(() => false),
    setEditable: vi.fn(),
    chain: vi.fn(() => chain),
    commands: { setContent: vi.fn(), clearContent: vi.fn(), undo: vi.fn() },
    destroy: () => {
      lifecycle.destroyed = true;
      lifecycle.schema = null;
    },
  };
  return editor;
}

const renderEditor = (
  kind: "textarea" | "answer",
  value = "<p>Current</p>",
) => {
  const props = {
    id: "requirements",
    value,
    onChange: vi.fn(),
    placeholder: "Describe the requirement",
  };
  const html = renderToStaticMarkup(
    kind === "textarea" ? (
      <AnimatedTextarea {...props} />
    ) : (
      <TiptapAnswerEditor {...props} contentFormat="html" />
    ),
  );
  const sync = harness.effects[0];
  if (!sync)
    throw new Error("The content synchronization effect was not captured");
  return { html, sync, onChange: props.onChange };
};

beforeEach(() => {
  harness.editor = createEditor();
  harness.effects = [];
  harness.callbacks = {};
  harness.onTranscript = undefined;
});

describe.each(["textarea", "answer"] as const)(
  "%s editor lifecycle",
  (kind) => {
    it("does not read the null schema when the sync effect is replayed after teardown", () => {
      const editor = harness.editor!;
      const { sync } = renderEditor(kind);
      expect(() => sync()).not.toThrow();
      editor.destroy();
      // This uses the installed Tiptap serializer and proves the fixture carries
      // the exact browser failure, not just an invented exception.
      expect(() => editor.getHTML()).toThrow(
        "Cannot read properties of null (reading 'cached')",
      );
      editor.getHTML.mockClear();
      editor.getText.mockClear();
      editor.setEditable.mockClear();
      expect(() => sync()).not.toThrow();
      expect(editor.getHTML).not.toHaveBeenCalled();
      expect(editor.getText).not.toHaveBeenCalled();
      expect(editor.setEditable).not.toHaveBeenCalled();
    });

    it("still synchronizes changed content on a live editor without emitting an update", () => {
      const editor = harness.editor!;
      const { sync } = renderEditor(kind, "<p>Updated requirement</p>");
      sync();
      expect(editor.commands.setContent).toHaveBeenCalledWith(
        "<p>Updated requirement</p>",
        { emitUpdate: false },
      );
      expect(editor.setEditable).toHaveBeenCalledWith(true);
    });

    it("ignores late updates and voice transcripts from a destroyed editor", () => {
      const editor = harness.editor!;
      const { onChange } = renderEditor(kind);
      editor.destroy();
      expect(() => harness.callbacks.onUpdate?.({ editor })).not.toThrow();
      expect(() => harness.onTranscript?.("Late transcript")).not.toThrow();
      expect(onChange).not.toHaveBeenCalled();
      expect(editor.chain).not.toHaveBeenCalled();
    });

    it("does not render toolbar reads against a disposed schema", () => {
      const editor = harness.editor!;
      editor.destroy();
      const { html } = renderEditor(kind);
      expect(html).toBe("");
      expect(editor.isActive).not.toHaveBeenCalled();
    });
  },
);
