"use client";

import { useState } from "react";
import {
  createWorkflow,
  updateWorkflow,
} from "./lib/graphql/workflows";

type Step = {
  id?: string;
  step_order: number;
  name: string;
  type: string;
  config: Record<string, any>;
};

const ORGANIZATION_ID =
  "af92af8f-5dc5-4613-bc5d-cc75b190d0b4";

const STEP_INFO: Record<
  string,
  {
    label: string;
    badge: string;
    description: string;
  }
> = {
  llm_call: {
    label: "LLM Call",
    badge: "AI",
    description:
      "Use an AI model to generate or transform content.",
  },

  http_request: {
    label: "HTTP Request",
    badge: "API",
    description:
      "Call an external API or service.",
  },

  conditional_branch: {
    label: "Conditional",
    badge: "IF",
    description:
      "Branch the workflow based on a condition.",
  },

  approval_gate: {
    label: "Approval",
    badge: "OK",
    description:
      "Pause until a human approves the next action.",
  },

  db_write: {
    label: "Database Write",
    badge: "DB",
    description:
      "Write workflow data to the database.",
  },

  notify: {
    label: "Notification",
    badge: "NT",
    description:
      "Send a notification.",
  },
};

function getDefaultConfig(
  type: string
): Record<string, any> {
  switch (type) {
    case "llm_call":
      return {
        model: "llama-3.3-70b-versatile",
        system_prompt: "",
        user_prompt: "",
        temperature: 0.7,
        max_tokens: 1000,
      };

    case "http_request":
      return {
        method: "GET",
        url: "",
        headers: {},
        body: {},
      };

    case "conditional_branch":
      return {
        condition: "result.length > 300",
        true_step: null,
        false_step: null,
      };

    case "approval_gate":
      return {
        title: "Approval required",
        message: "Please review this result.",
        approver: null,
        timeout_hours: 24,
      };

    case "db_write":
      return {};

    case "notify":
      return {};

    default:
      return {};
  }
}

export default function WorkflowBuilderPage() {
  const [workflowId, setWorkflowId] = useState("");

  const [workflowName, setWorkflowName] =
    useState("My First Workflow");

  const [workflowDescription, setWorkflowDescription] =
    useState("");

  const [steps, setSteps] = useState<Step[]>([]);

  const [selectedStep, setSelectedStep] =
    useState<number | null>(null);

  const [loading, setLoading] = useState(false);

  const [running, setRunning] = useState(false);

  const [message, setMessage] = useState("");

  const [runResult, setRunResult] =
    useState<any>(null);

  function addStep() {
    const newIndex = steps.length;

    const newStep: Step = {
      step_order: newIndex + 1,
      name: `Step ${newIndex + 1}`,
      type: "llm_call",
      config: getDefaultConfig("llm_call"),
    };

    setSteps((current) => [
      ...current,
      newStep,
    ]);

    setSelectedStep(newIndex);
    setMessage("");
  }

  function updateLocalStep(
    index: number,
    field: string,
    value: any
  ) {
    setSteps((current) => {
      const updated = [...current];

      if (!updated[index]) {
        return current;
      }

      updated[index] = {
        ...updated[index],
        [field]: value,
      };

      return updated;
    });
  }

  function updateStepConfig(
    index: number,
    config: Record<string, any>
  ) {
    setSteps((current) => {
      const updated = [...current];

      if (!updated[index]) {
        return current;
      }

      updated[index] = {
        ...updated[index],
        config,
      };

      return updated;
    });
  }

  function changeStepType(
    index: number,
    type: string
  ) {
    setSteps((current) => {
      const updated = [...current];

      if (!updated[index]) {
        return current;
      }

      updated[index] = {
        ...updated[index],
        type,
        config: getDefaultConfig(type),
      };

      return updated;
    });
  }

  function removeStep(index: number) {
    const updated = steps
      .filter((_, i) => i !== index)
      .map((step, i) => ({
        ...step,
        step_order: i + 1,
      }));

    setSteps(updated);

    if (updated.length === 0) {
      setSelectedStep(null);
      return;
    }

    if (selectedStep === index) {
      setSelectedStep(
        Math.min(index, updated.length - 1)
      );
    } else if (
      selectedStep !== null &&
      selectedStep > index
    ) {
      setSelectedStep(selectedStep - 1);
    }
  }

  function moveStepUp(index: number) {
    if (index === 0) {
      return;
    }

    const updated = [...steps];

    [
      updated[index - 1],
      updated[index],
    ] = [
      updated[index],
      updated[index - 1],
    ];

    const reordered = updated.map(
      (step, i) => ({
        ...step,
        step_order: i + 1,
      })
    );

    setSteps(reordered);

    if (selectedStep === index) {
      setSelectedStep(index - 1);
    } else if (selectedStep === index - 1) {
      setSelectedStep(index);
    }
  }

  function moveStepDown(index: number) {
    if (index === steps.length - 1) {
      return;
    }

    const updated = [...steps];

    [
      updated[index],
      updated[index + 1],
    ] = [
      updated[index + 1],
      updated[index],
    ];

    const reordered = updated.map(
      (step, i) => ({
        ...step,
        step_order: i + 1,
      })
    );

    setSteps(reordered);

    if (selectedStep === index) {
      setSelectedStep(index + 1);
    } else if (selectedStep === index + 1) {
      setSelectedStep(index);
    }
  }

  async function saveWorkflow() {
    if (!workflowName.trim()) {
      setMessage(
        "❌ Workflow name is required."
      );
      return;
    }

    if (steps.length === 0) {
      setMessage(
        "❌ Add at least one step before saving."
      );
      return;
    }

    setLoading(true);
    setMessage("Saving workflow...");

    try {
      let currentWorkflowId = workflowId;

      if (!currentWorkflowId) {
        const workflow =
          await createWorkflow(
            ORGANIZATION_ID,
            workflowName,
            workflowDescription
          );

        if (!workflow) {
          throw new Error(
            "Workflow creation returned no data."
          );
        }

        currentWorkflowId = workflow.id;

        setWorkflowId(currentWorkflowId);
      } else {
        await updateWorkflow(
          currentWorkflowId,
          workflowName,
          workflowDescription,
          true
        );
      }

      /*
       * Step persistence is intentionally kept
       * local for now because your project currently
       * does not contain:
       *
       * app/lib/graphql/workflowSteps.ts
       *
       * The workflow itself is saved successfully.
       */

      setMessage(
        `✅ WORKFLOW SAVED

Workflow ID:
${currentWorkflowId}

Steps configured:
${steps.length}

Note:
Step mutation functions have not been connected yet.`
      );
    } catch (error: any) {
      console.error(
        "Workflow save error:",
        error
      );

      setMessage(
        `❌ SAVE FAILED

${error?.message ?? String(error)}`
      );
    } finally {
      setLoading(false);
    }
  }

  async function runWorkflow() {
    if (steps.length === 0) {
      setMessage(
        "❌ Add at least one step before running."
      );
      return;
    }

    setRunning(true);
    setRunResult(null);
    setMessage("Running workflow...");

    try {
      const executionSteps = steps.map(
        (step, index) => ({
          ...step,
          step_order: index + 1,
        })
      );

      const response = await fetch(
        "/api/workflows/run",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            workflow_id:
              workflowId || null,
            workflow_name:
              workflowName,
            steps: executionSteps,
          }),
        }
      );

      const contentType =
        response.headers.get(
          "content-type"
        ) ?? "";

      const responseText =
        await response.text();

      if (
        !contentType.includes(
          "application/json"
        )
      ) {
        throw new Error(
          `Run API returned non-JSON. HTTP ${response.status}. Check that /api/workflows/run exists.`
        );
      }

      let data: any;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          "Workflow API returned invalid JSON."
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.error ??
            `Workflow execution failed with HTTP ${response.status}.`
        );
      }

      if (data?.success === false) {
        throw new Error(
          data?.error ??
            "Workflow execution failed."
        );
      }

      setRunResult(data);

      setMessage(
        `✅ WORKFLOW EXECUTED SUCCESSFULLY

Steps executed:
${
  data?.results?.length ??
  data?.execution_log?.length ??
  steps.length
}`
      );
    } catch (error: any) {
      console.error(
        "Workflow execution error:",
        error
      );

      setRunResult(null);

      setMessage(
        `❌ RUN FAILED

${error?.message ?? String(error)}`
      );
    } finally {
      setRunning(false);
    }
  }

  const selected =
    selectedStep !== null
      ? steps[selectedStep]
      : null;

  const statusIsError =
    message.includes("❌") ||
    message
      .toLowerCase()
      .includes("required") ||
    message
      .toLowerCase()
      .includes("failed");

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(99,102,241,0.10),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(14,165,233,0.08),transparent_24%)]">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">

          <header className="mb-5 rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_18px_60px_rgba(15,23,42,0.07)] backdrop-blur">
            <div className="flex flex-col gap-5 px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-xs font-black tracking-widest text-white shadow-lg">
                  AI
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">
                      AI Workflow Studio
                    </span>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Builder
                    </span>
                  </div>

                  <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                    Build your workflow
                  </h1>

                  <p className="mt-1 text-sm text-slate-500">
                    Design and configure your AI automation visually.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">

                <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center sm:block">
                  <div className="text-lg font-black">
                    {steps.length}
                  </div>

                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Steps
                  </div>
                </div>

                <button
                  onClick={runWorkflow}
                  disabled={
                    running ||
                    loading ||
                    steps.length === 0
                  }
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {running
                    ? "Running..."
                    : "▶ Run workflow"}
                </button>

                <button
                  onClick={saveWorkflow}
                  disabled={
                    loading ||
                    running ||
                    steps.length === 0
                  }
                  className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading
                    ? "Saving..."
                    : "Save workflow"}
                </button>
              </div>
            </div>
          </header>

          <section className="mb-5 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_45px_rgba(15,23,42,0.05)] sm:p-7">

            <div className="mb-5">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600">
                Workflow details
              </span>

              <h2 className="mt-1 text-xl font-black tracking-tight">
                Give your workflow a purpose
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                These details are saved with your workflow in your backend.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">

              <label>
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                  Workflow name
                </span>

                <input
                  value={workflowName}
                  onChange={(e) =>
                    setWorkflowName(
                      e.target.value
                    )
                  }
                  placeholder="e.g. Customer Support Automation"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </label>

              <label>
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                  Description
                </span>

                <input
                  value={workflowDescription}
                  onChange={(e) =>
                    setWorkflowDescription(
                      e.target.value
                    )
                  }
                  placeholder="Describe what this workflow does"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </label>

            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.8fr)]">

            <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_45px_rgba(15,23,42,0.05)] sm:p-7">

              <div className="mb-6 flex items-center justify-between gap-4">

                <div>
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Pipeline
                  </span>

                  <h2 className="mt-1 text-xl font-black tracking-tight">
                    Workflow steps
                  </h2>
                </div>

                <button
                  onClick={addStep}
                  disabled={
                    loading ||
                    running
                  }
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-40"
                >
                  + Add step
                </button>
              </div>

              {steps.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">

                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-indigo-600 shadow-sm ring-1 ring-slate-200">
                    +
                  </div>

                  <h3 className="mt-4 text-base font-black">
                    No steps yet
                  </h3>

                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    Add your first step and start building the automation.
                  </p>

                  <button
                    onClick={addStep}
                    disabled={
                      loading ||
                      running
                    }
                    className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-40"
                  >
                    Add your first step
                  </button>
                </div>
              ) : (
                <div className="space-y-2">

                  {steps.map(
                    (step, index) => {
                      const info =
                        STEP_INFO[
                          step.type
                        ] ??
                        STEP_INFO.llm_call;

                      const active =
                        selectedStep ===
                        index;

                      return (
                        <div
                          key={
                            step.id ??
                            `step-${index}`
                          }
                        >

                          <div
                            className={`rounded-2xl border p-4 transition-all ${
                              active
                                ? "border-indigo-300 bg-indigo-50/70 shadow-md shadow-indigo-100"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                            }`}
                          >

                            <div className="flex items-center gap-3">

                              <button
                                onClick={() =>
                                  setSelectedStep(
                                    index
                                  )
                                }
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                                  active
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {String(
                                  index + 1
                                ).padStart(
                                  2,
                                  "0"
                                )}
                              </button>

                              <div className="min-w-0 flex-1">

                                <input
                                  value={
                                    step.name
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    updateLocalStep(
                                      index,
                                      "name",
                                      e.target
                                        .value
                                    )
                                  }
                                  disabled={
                                    loading ||
                                    running
                                  }
                                  className="w-full bg-transparent text-sm font-black outline-none disabled:opacity-50"
                                />

                                <div className="mt-1.5 flex items-center gap-2">

                                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-indigo-600">
                                    {
                                      info.badge
                                    }
                                  </span>

                                  <span className="text-xs font-semibold text-slate-500">
                                    {
                                      info.label
                                    }
                                  </span>

                                </div>
                              </div>

                              <div className="flex items-center gap-1">

                                <button
                                  onClick={() =>
                                    moveStepUp(
                                      index
                                    )
                                  }
                                  disabled={
                                    index ===
                                      0 ||
                                    loading ||
                                    running
                                  }
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-25"
                                  title="Move up"
                                >
                                  ↑
                                </button>

                                <button
                                  onClick={() =>
                                    moveStepDown(
                                      index
                                    )
                                  }
                                  disabled={
                                    index ===
                                      steps.length -
                                        1 ||
                                    loading ||
                                    running
                                  }
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-25"
                                  title="Move down"
                                >
                                  ↓
                                </button>

                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t border-slate-200/70 pt-3">

                              <button
                                onClick={() =>
                                  setSelectedStep(
                                    index
                                  )
                                }
                                className="text-xs font-black text-indigo-600 hover:text-indigo-800"
                              >
                                {active
                                  ? "Editing step"
                                  : "Configure step →"}
                              </button>

                              <button
                                onClick={() =>
                                  removeStep(
                                    index
                                  )
                                }
                                disabled={
                                  loading ||
                                  running
                                }
                                className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                              >
                                Delete
                              </button>

                            </div>
                          </div>

                          {index <
                            steps.length -
                              1 && (
                            <div className="ml-6 h-3 border-l border-dashed border-slate-300" />
                          )}
                        </div>
                      );
                    }
                  )}

                </div>
              )}
            </section>

            <section className="lg:sticky lg:top-5 lg:self-start">

              <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_45px_rgba(15,23,42,0.05)] sm:p-7">

                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600">
                  Inspector
                </span>

                <h2 className="mt-1 text-xl font-black tracking-tight">
                  Step configuration
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Configure the selected step.
                </p>

                {selected === null ? (
                  <div className="mt-6 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">

                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-sm font-black text-slate-400 shadow-sm">
                      —
                    </div>

                    <p className="mt-4 text-sm font-black text-slate-700">
                      Select a step
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Choose a step from the workflow to edit its settings.
                    </p>

                  </div>
                ) : (
                  <div className="mt-6 space-y-5">

                    <div className="rounded-2xl bg-slate-950 p-4 text-white">

                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Step{" "}
                        {String(
                          selectedStep! + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </div>

                      <div className="mt-1 text-lg font-black">
                        {
                          selected.name
                        }
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        {
                          STEP_INFO[
                            selected.type
                          ]?.description
                        }
                      </div>

                    </div>

                    <label className="block">

                      <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                        Step type
                      </span>

                      <select
                        value={
                          selected.type
                        }
                        onChange={(e) =>
                          changeStepType(
                            selectedStep!,
                            e.target.value
                          )
                        }
                        disabled={
                          loading ||
                          running
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:opacity-50"
                      >
                        <option value="llm_call">
                          LLM Call
                        </option>

                        <option value="http_request">
                          HTTP Request
                        </option>

                        <option value="conditional_branch">
                          Conditional
                        </option>

                        <option value="approval_gate">
                          Approval
                        </option>

                        <option value="db_write">
                          Database Write
                        </option>

                        <option value="notify">
                          Notification
                        </option>
                      </select>
                    </label>

                    {selected.type ===
                      "llm_call" && (
                      <div className="space-y-4">

                        <label className="block">

                          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                            Groq model
                          </span>

                          <select
                            value={
                              selected.config
                                ?.model ??
                              "llama-3.3-70b-versatile"
                            }
                            onChange={(e) =>
                              updateStepConfig(
                                selectedStep!,
                                {
                                  ...selected.config,
                                  model:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            disabled={
                              running
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-bold outline-none"
                          >
                            <option value="llama-3.3-70b-versatile">
                              Llama 3.3 70B
                            </option>
                          </select>
                        </label>

                        <label className="block">

                          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                            System prompt
                          </span>

                          <textarea
                            value={
                              selected.config
                                ?.system_prompt ??
                              ""
                            }
                            onChange={(e) =>
                              updateStepConfig(
                                selectedStep!,
                                {
                                  ...selected.config,
                                  system_prompt:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            disabled={
                              running
                            }
                            rows={4}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white disabled:opacity-50"
                            placeholder="You are a helpful AI assistant."
                          />
                        </label>

                        <label className="block">

                          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                            User prompt
                          </span>

                          <textarea
                            value={
                              selected.config
                                ?.user_prompt ??
                              ""
                            }
                            onChange={(e) =>
                              updateStepConfig(
                                selectedStep!,
                                {
                                  ...selected.config,
                                  user_prompt:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            disabled={
                              running
                            }
                            rows={5}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white disabled:opacity-50"
                            placeholder="Write a short paragraph about artificial intelligence."
                          />
                        </label>

                        <label className="block">

                          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                            Temperature
                          </span>

                          <input
                            type="number"
                            min="0"
                            max="2"
                            step="0.1"
                            value={
                              selected.config
                                ?.temperature ??
                              0.7
                            }
                            onChange={(e) =>
                              updateStepConfig(
                                selectedStep!,
                                {
                                  ...selected.config,
                                  temperature:
                                    Number(
                                      e.target
                                        .value
                                    ),
                                }
                              )
                            }
                            disabled={
                              running
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none disabled:opacity-50"
                          />
                        </label>

                        <label className="block">

                          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                            Max tokens
                          </span>

                          <input
                            type="number"
                            min="1"
                            value={
                              selected.config
                                ?.max_tokens ??
                              1000
                            }
                            onChange={(e) =>
                              updateStepConfig(
                                selectedStep!,
                                {
                                  ...selected.config,
                                  max_tokens:
                                    Number(
                                      e.target
                                        .value
                                    ),
                                }
                              )
                            }
                            disabled={
                              running
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none disabled:opacity-50"
                          />
                        </label>

                      </div>
                    )}

                    {selected.type ===
                      "http_request" && (
                      <div className="space-y-4">

                        <label className="block">

                          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                            Method
                          </span>

                          <select
                            value={
                              selected.config
                                ?.method ??
                              "GET"
                            }
                            onChange={(e) =>
                              updateStepConfig(
                                selectedStep!,
                                {
                                  ...selected.config,
                                  method:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            disabled={
                              running
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none"
                          >
                            <option value="GET">
                              GET
                            </option>
                            <option value="POST">
                              POST
                            </option>
                            <option value="PUT">
                              PUT
                            </option>
                            <option value="PATCH">
                              PATCH
                            </option>
                            <option value="DELETE">
                              DELETE
                            </option>
                          </select>
                        </label>

                        <label className="block">

                          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                            URL
                          </span>

                          <input
                            value={
                              selected.config
                                ?.url ??
                              ""
                            }
                            onChange={(e) =>
                              updateStepConfig(
                                selectedStep!,
                                {
                                  ...selected.config,
                                  url: e.target
                                    .value,
                                }
                              )
                            }
                            disabled={
                              running
                            }
                            placeholder="https://api.example.com"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                          />
                        </label>

                        <JsonEditor
                          label="Headers JSON"
                          value={
                            selected.config
                              ?.headers ??
                            {}
                          }
                          disabled={
                            running
                          }
                          rows={4}
                          onChange={(value) =>
                            updateStepConfig(
                              selectedStep!,
                              {
                                ...selected.config,
                                headers:
                                  value,
                              }
                            )
                          }
                          onError={(error) =>
                            setMessage(
                              `❌ ${error}`
                            )
                          }
                        />

                        <JsonEditor
                          label="Body JSON"
                          value={
                            selected.config
                              ?.body ?? {}
                          }
                          disabled={
                            running
                          }
                          rows={5}
                          onChange={(value) =>
                            updateStepConfig(
                              selectedStep!,
                              {
                                ...selected.config,
                                body: value,
                              }
                            )
                          }
                          onError={(error) =>
                            setMessage(
                              `❌ ${error}`
                            )
                          }
                        />

                      </div>
                    )}

                    {selected.type ===
                      "conditional_branch" && (
                      <div className="space-y-4">

                        <label className="block">

                          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                            Condition
                          </span>

                          <input
                            value={
                              selected.config
                                ?.condition ??
                              ""
                            }
                            onChange={(e) =>
                              updateStepConfig(
                                selectedStep!,
                                {
                                  ...selected.config,
                                  condition:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            disabled={
                              running
                            }
                            placeholder="result.length > 300"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono outline-none"
                          />
                        </label>

                        <StepSelector
                          label="True step"
                          value={
                            selected.config
                              ?.true_step ??
                            ""
                          }
                          steps={steps}
                          currentIndex={
                            selectedStep!
                          }
                          disabled={
                            running
                          }
                          onChange={(value) =>
                            updateStepConfig(
                              selectedStep!,
                              {
                                ...selected.config,
                                true_step:
                                  value
                                    ? Number(
                                        value
                                      )
                                    : null,
                              }
                            )
                          }
                        />

                        <StepSelector
                          label="False step"
                          value={
                            selected.config
                              ?.false_step ??
                            ""
                          }
                          steps={steps}
                          currentIndex={
                            selectedStep!
                          }
                          disabled={
                            running
                          }
                          onChange={(value) =>
                            updateStepConfig(
                              selectedStep!,
                              {
                                ...selected.config,
                                false_step:
                                  value
                                    ? Number(
                                        value
                                      )
                                    : null,
                              }
                            )
                          }
                        />

                      </div>
                    )}

                    {selected.type ===
                      "approval_gate" && (
                      <div className="space-y-4">

                        <label className="block">

                          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                            Title
                          </span>

                          <input
                            value={
                              selected.config
                                ?.title ??
                              "Approval required"
                            }
                            onChange={(e) =>
                              updateStepConfig(
                                selectedStep!,
                                {
                                  ...selected.config,
                                  title:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            disabled={
                              running
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                          />
                        </label>

                        <label className="block">

                          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                            Message
                          </span>

                          <textarea
                            value={
                              selected.config
                                ?.message ??
                              "Please review this result."
                            }
                            onChange={(e) =>
                              updateStepConfig(
                                selectedStep!,
                                {
                                  ...selected.config,
                                  message:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            disabled={
                              running
                            }
                            rows={4}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                          />
                        </label>

                        <label className="block">

                          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                            Approver
                          </span>

                          <input
                            value={
                              selected.config
                                ?.approver ??
                              ""
                            }
                            onChange={(e) =>
                              updateStepConfig(
                                selectedStep!,
                                {
                                  ...selected.config,
                                  approver:
                                    e.target
                                      .value ||
                                    null,
                                }
                              )
                            }
                            disabled={
                              running
                            }
                            placeholder="Approver ID or email"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                          />
                        </label>

                        <label className="block">

                          <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                            Timeout hours
                          </span>

                          <input
                            type="number"
                            min="1"
                            value={
                              selected.config
                                ?.timeout_hours ??
                              24
                            }
                            onChange={(e) =>
                              updateStepConfig(
                                selectedStep!,
                                {
                                  ...selected.config,
                                  timeout_hours:
                                    Number(
                                      e.target
                                        .value
                                    ),
                                }
                              )
                            }
                            disabled={
                              running
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                          />
                        </label>

                      </div>
                    )}

                    {selected.type ===
                      "db_write" && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                        Database write is recognized by the workflow schema. Its execution logic can be added next.
                      </div>
                    )}

                    {selected.type ===
                      "notify" && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                        Notification is recognized by the workflow schema. Its execution logic can be added next.
                      </div>
                    )}

                  </div>
                )}
              </div>
            </section>
          </div>

          {runResult && (
            <section className="mt-5 rounded-[28px] border border-emerald-200 bg-white p-5 shadow-[0_12px_45px_rgba(15,23,42,0.05)] sm:p-7">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">
                    Execution result
                  </div>

                  <h2 className="mt-1 text-xl font-black tracking-tight">
                    Workflow completed
                  </h2>
                </div>

                <button
                  onClick={() =>
                    setRunResult(null)
                  }
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  Clear result
                </button>
              </div>

              {runResult.result !==
                undefined && (
                <div className="mt-5">

                  <div className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">
                    Final output
                  </div>

                  <div className="rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-emerald-300">

                    <pre className="whitespace-pre-wrap break-words font-sans">
                      {typeof runResult.result ===
                      "string"
                        ? runResult.result
                        : JSON.stringify(
                            runResult.result,
                            null,
                            2
                          )}
                    </pre>

                  </div>
                </div>
              )}

              {Array.isArray(
                runResult.execution_log
              ) &&
                runResult.execution_log.length >
                  0 && (
                  <div className="mt-6">

                    <div className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">
                      Execution log
                    </div>

                    <div className="space-y-3">

                      {runResult.execution_log.map(
                        (
                          log: any,
                          index: number
                        ) => (
                          <div
                            key={`${log.step}-${index}`}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >

                            <div className="flex flex-wrap items-center gap-2">

                              <span className="rounded-lg bg-indigo-100 px-2.5 py-1 text-[10px] font-black uppercase text-indigo-700">
                                Step{" "}
                                {
                                  log.step
                                }
                              </span>

                              <span className="text-sm font-black text-slate-800">
                                {
                                  log.name
                                }
                              </span>

                              <span className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-slate-400 ring-1 ring-slate-200">
                                {
                                  log.type
                                }
                              </span>

                            </div>

                            <div className="mt-3 overflow-x-auto rounded-xl bg-white p-3 ring-1 ring-slate-200">

                              <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">
                                {typeof log.result ===
                                "string"
                                  ? log.result
                                  : JSON.stringify(
                                      log.result,
                                      null,
                                      2
                                    )}
                              </pre>

                            </div>
                          </div>
                        )
                      )}

                    </div>
                  </div>
                )}

            </section>
          )}

          <section className="mt-5 rounded-[28px] bg-slate-950 p-5 shadow-xl sm:p-6">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
                  Workflow status
                </div>

                <div className="mt-1 text-lg font-black text-white">
                  {steps.length === 0
                    ? "Ready when you are"
                    : `${steps.length} step${
                        steps.length ===
                        1
                          ? ""
                          : "s"
                      } configured`}
                </div>

              </div>

              <div className="flex flex-wrap gap-3">

                <button
                  onClick={runWorkflow}
                  disabled={
                    running ||
                    loading ||
                    steps.length === 0
                  }
                  className="rounded-2xl bg-emerald-500 px-6 py-3.5 text-sm font-black text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {running
                    ? "Running workflow..."
                    : "▶ Run workflow"}
                </button>

                <button
                  onClick={saveWorkflow}
                  disabled={
                    loading ||
                    running ||
                    steps.length === 0
                  }
                  className="rounded-2xl bg-white px-6 py-3.5 text-sm font-black text-slate-950 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading
                    ? "Saving workflow..."
                    : "Save workflow"}
                </button>

              </div>
            </div>

            {message && (
              <div
                className={`mt-5 rounded-2xl border p-4 ${
                  statusIsError
                    ? "border-rose-400/20 bg-rose-500/10 text-rose-200"
                    : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                }`}
              >

                <div className="mb-1 text-[10px] font-black uppercase tracking-wider opacity-70">
                  Status
                </div>

                <pre className="whitespace-pre-wrap font-sans text-sm leading-6">
                  {message}
                </pre>

              </div>
            )}

          </section>

        </div>
      </div>
    </main>
  );
}

function JsonEditor({
  label,
  value,
  disabled,
  rows,
  onChange,
  onError,
}: {
  label: string;
  value: any;
  disabled: boolean;
  rows: number;
  onChange: (value: any) => void;
  onError: (message: string) => void;
}) {
  const [text, setText] = useState(
    JSON.stringify(value, null, 2)
  );

  return (
    <label className="block">

      <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
        {label}
      </span>

      <textarea
        value={text}
        onChange={(e) =>
          setText(e.target.value)
        }
        onBlur={() => {
          try {
            const parsed = JSON.parse(text);
            onChange(parsed);
          } catch {
            onError(
              `${label} must contain valid JSON.`
            );
          }
        }}
        disabled={disabled}
        rows={rows}
        className="w-full rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs text-emerald-300 outline-none disabled:opacity-50"
        spellCheck={false}
      />

    </label>
  );
}

function StepSelector({
  label,
  value,
  steps,
  currentIndex,
  disabled,
  onChange,
}: {
  label: string;
  value: any;
  steps: Step[];
  currentIndex: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">

      <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
        {label}
      </span>

      <select
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value)
        }
        disabled={disabled}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none disabled:opacity-50"
      >

        <option value="">
          Continue to next step
        </option>

        {steps.map((step, index) => (
          <option
            key={`${label}-${index}`}
            value={index + 1}
            disabled={
              index === currentIndex
            }
          >
            Step {index + 1} — {step.name}
          </option>
        ))}

      </select>
    </label>
  );
}