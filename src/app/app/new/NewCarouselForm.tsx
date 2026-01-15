"use client";

import * as React from "react";

type PaletteV1 = { background: string; text: string; accent: string };

type Option = { id: string; name: string; is_global?: boolean };

type TemplateMeta = {
  id: string;
  name: string;
  kind: "visual" | "layout" | "builtin";
  slidesCount: number | null;
  palette: PaletteV1 | null;
  prompt?: string | null;
};

type Labels = {
  title: string;
  subtitle: string;
  inputMode: string;
  inputModeTopic: string;
  inputModePrompt: string;
  slides: string;
  topic: string;
  prompt: string;
  tone: string;
  audience: string;
  language: string;
  templateId: string;
  presetId: string;
  palette: string;
  paletteBackground: string;
  paletteText: string;
  paletteAccent: string;
  create: string;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  error?: string | null;
  defaultDraftLanguage: string;
  tones: Option[];
  audiences: Option[];
  templates: TemplateMeta[];
  presets: Option[];
  palettes: Array<Option & { palette: PaletteV1 }>;
  labels: Labels;
};

const CUSTOM_PALETTE_ID = "__custom__";
const CUSTOM_INPUT_VALUE = "__custom__";

export default function NewCarouselForm({
  action,
  error,
  defaultDraftLanguage,
  tones,
  audiences,
  templates,
  presets,
  palettes,
  labels
}: Props) {
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("");
  const [slidesCount, setSlidesCount] = React.useState(5);
  const [slidesLocked, setSlidesLocked] = React.useState(false);
  const [inputMode, setInputMode] = React.useState<"topic" | "prompt">("topic");
  const [promptValue, setPromptValue] = React.useState("");
  const [paletteId, setPaletteId] = React.useState("");
  const [paletteValues, setPaletteValues] = React.useState<PaletteV1>({
    background: "",
    text: "",
    accent: ""
  });
  const manualPaletteEnabled = paletteId === CUSTOM_PALETTE_ID;

  const templateOptions = React.useMemo(() => {
    const visual = templates.filter((t) => t.kind === "visual");
    const layout = templates.filter((t) => t.kind === "layout");
    const builtin = templates.filter((t) => t.kind === "builtin");
    return { visual, layout, builtin };
  }, [templates]);

  const handleTemplateChange = (value: string) => {
    setSelectedTemplateId(value);
    const selected = templates.find((t) => t.id === value) ?? null;
    if (
      selected?.kind === "visual" &&
      typeof selected.slidesCount === "number" &&
      selected.slidesCount > 0
    ) {
      setSlidesCount(selected.slidesCount);
      setSlidesLocked(true);
    } else {
      setSlidesLocked(false);
    }
    if (selected?.palette) {
      setPaletteId(CUSTOM_PALETTE_ID);
      setPaletteValues(selected.palette);
    }
    if (selected?.kind === "visual" && selected.prompt) {
      setInputMode("prompt");
      setPromptValue(selected.prompt);
    }
  };

  const handlePaletteChange = (value: string) => {
    setPaletteId(value);
    if (value === CUSTOM_PALETTE_ID || value === "") return;
    const selected = palettes.find((p) => p.id === value);
    if (selected) setPaletteValues(selected.palette);
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Novo carrossel
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">{labels.title}</h1>
            <p className="text-sm text-slate-600">{labels.subtitle}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-xs text-slate-500 shadow-sm backdrop-blur">
            Dica: você pode trocar template, paleta e imagens depois no estúdio.
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form
          action={action}
          className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
        >
          <div className="space-y-6">
            <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">
                  Configuração base
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                  obrigatória
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium">{labels.inputMode}</span>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    name="inputMode"
                    value={inputMode}
                    onChange={(e) =>
                      setInputMode(
                        e.target.value === "prompt" ? "prompt" : "topic"
                      )
                    }
                  >
                    <option value="topic">{labels.inputModeTopic}</option>
                    <option value="prompt">{labels.inputModePrompt}</option>
                  </select>
                  <p className="text-xs text-slate-500">
                    Tema gera o roteiro a partir de um assunto. Prompt é quando você
                    já sabe exatamente o que quer pedir.
                  </p>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">{labels.slides}</span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    name="slidesCount"
                    type="number"
                    min={2}
                    max={10}
                    value={slidesCount}
                    onChange={(e) => setSlidesCount(Number(e.target.value))}
                    required
                    disabled={slidesLocked}
                  />
                  {slidesLocked ? (
                    <input type="hidden" name="slidesCount" value={slidesCount} />
                  ) : null}
                  {slidesLocked ? (
                    <p className="text-xs text-slate-500">
                      Este template define o total de slides.
                    </p>
                  ) : null}
                </label>
              </div>
            </section>

            <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur">
              <div className="text-sm font-semibold text-slate-900">Conteúdo</div>
              <label className="block space-y-2">
                <span className="text-sm font-medium">{labels.topic}</span>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  name="topic"
                  placeholder="Ex: Estratégias para vender serviços premium"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">{labels.prompt}</span>
                <textarea
                  className="h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  name="prompt"
                  placeholder="Descreva o objetivo do carrossel, estilo visual e ganchos."
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                />
              </label>
              {selectedTemplateId && inputMode === "prompt" && promptValue ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  Prompt do template aplicado como base. Se você preencher o campo
                  “Tema”, ele será anexado ao prompt automaticamente.
                </div>
              ) : null}
            </section>

            <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur">
              <div className="text-sm font-semibold text-slate-900">Tom e público</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="block space-y-2">
                  <span className="text-sm font-medium">{labels.tone}</span>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    name="tonePreset"
                    defaultValue=""
                  >
                    <option value="">Escolher tom</option>
                    {tones.map((tone) => (
                      <option key={tone.id} value={tone.name}>
                        {tone.name}
                      </option>
                    ))}
                    <option value={CUSTOM_INPUT_VALUE}>Outro (manual)</option>
                  </select>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    name="toneCustom"
                    placeholder="Ou escreva um tom personalizado"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">{labels.audience}</span>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    name="audiencePreset"
                    defaultValue=""
                  >
                    <option value="">Escolher público</option>
                    {audiences.map((audience) => (
                      <option key={audience.id} value={audience.name}>
                        {audience.name}
                      </option>
                    ))}
                    <option value={CUSTOM_INPUT_VALUE}>Outro (manual)</option>
                  </select>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    name="audienceCustom"
                    placeholder="Ou escreva um público personalizado"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">{labels.language}</span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    name="language"
                    defaultValue={defaultDraftLanguage}
                  />
                </label>
              </div>
            </section>

            <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur">
              <div className="text-sm font-semibold text-slate-900">Imagens</div>
              <p className="text-xs text-slate-500">
                Faça upload das imagens que você quer usar no carrossel. Elas ficam
                disponíveis na aba de assets do estúdio.
              </p>
              <label className="block space-y-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Upload de imagens
                </span>
                <input
                  className="w-full text-sm"
                  type="file"
                  name="assetUploads"
                  accept="image/*"
                  multiple
                />
              </label>
              <div className="text-xs text-slate-500">
                Até 12 imagens por rascunho. PNG, JPG, WEBP ou GIF.
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="space-y-3 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur">
              <div className="text-sm font-semibold text-slate-900">Template</div>
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  {labels.templateId}
                </span>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  name="templateId"
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  <option value="">Sem template</option>
                  {templateOptions.visual.length > 0 ? (
                    <optgroup label="Visuais">
                      {templateOptions.visual.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {templateOptions.layout.length > 0 ? (
                    <optgroup label="Layouts">
                      {templateOptions.layout.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {templateOptions.builtin.length > 0 ? (
                    <optgroup label="Built-ins">
                      {templateOptions.builtin.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  {labels.presetId}
                </span>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  name="presetId"
                  defaultValue=""
                >
                  <option value="">Sem preset</option>
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="space-y-3 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur">
              <div className="text-sm font-semibold text-slate-900">{labels.palette}</div>
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  Paleta salva
                </span>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  name="paletteId"
                  value={paletteId}
                  onChange={(e) => handlePaletteChange(e.target.value)}
                >
                  <option value="">Automática</option>
                  <option value={CUSTOM_PALETTE_ID}>Custom</option>
                  {palettes.map((palette) => (
                    <option key={palette.id} value={palette.id}>
                      {palette.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Ajuste manual (Custom)
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <label className="block space-y-2">
                    <span className="text-xs font-medium text-slate-600">
                      {labels.paletteBackground}
                    </span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
                      name="paletteBackground"
                      placeholder="#ffffff"
                      value={paletteValues.background}
                      onChange={(e) =>
                        setPaletteValues((prev) => ({
                          ...prev,
                          background: e.target.value
                        }))
                      }
                      disabled={!manualPaletteEnabled}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-medium text-slate-600">
                      {labels.paletteText}
                    </span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
                      name="paletteText"
                      placeholder="#111827"
                      value={paletteValues.text}
                      onChange={(e) =>
                        setPaletteValues((prev) => ({
                          ...prev,
                          text: e.target.value
                        }))
                      }
                      disabled={!manualPaletteEnabled}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-medium text-slate-600">
                      {labels.paletteAccent}
                    </span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
                      name="paletteAccent"
                      placeholder="#a78bfa"
                      value={paletteValues.accent}
                      onChange={(e) =>
                        setPaletteValues((prev) => ({
                          ...prev,
                          accent: e.target.value
                        }))
                      }
                      disabled={!manualPaletteEnabled}
                    />
                  </label>
                </div>
              </div>
            </section>
          </aside>

          <div className="lg:col-span-2">
            <button
              className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 transition hover:bg-black/90"
              type="submit"
            >
              {labels.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
