import { NextRequest, NextResponse } from "next/server";

type WorkflowStep = {
  id?: string;
  step_order: number;
  name: string;
  type: string;
  config?: Record<string, any>;
};

type ExecuteRequest = {
  workflowId?: string;
  steps?: WorkflowStep[];
  input?: string;
};

function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function getEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

async function callGroq(
  config: Record<string, any>,
  input: string,
  previousOutput: string
) {
  const apiKey = getEnv("GROQ_API_KEY");

  const model =
    config?.model ||
    "llama-3.3-70b-versatile";

  const systemPrompt =
    config?.system_prompt ||
    "You are a helpful AI assistant.";

  let userPrompt =
    config?.user_prompt ||
    input ||
    "Process the provided input.";

  /*
   * Make previous step output available to the next LLM step.
   */
  userPrompt = userPrompt
    .replace(
      /\{\{\s*previous_output\s*\}\}/gi,
      previousOutput
    )
    .replace(
      /\{\{\s*input\s*\}\}/gi,
      input
    );

  if (
    previousOutput &&
    !userPrompt.includes(previousOutput)
  ) {
    userPrompt = `${userPrompt}

Previous step output:
${previousOutput}`;
  }

  const temperature =
    typeof config?.temperature === "number"
      ? config.temperature
      : 0.7;

  const maxTokens =
    typeof config?.max_tokens === "number"
      ? config.max_tokens
      : 1000;

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    }
  );

  const responseText = await response.text();

  let data: any;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Groq returned non-JSON response (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `Groq request failed with status ${response.status}.`
    );
  }

  const output =
    data?.choices?.[0]?.message?.content;

  if (typeof output !== "string") {
    throw new Error(
      "Groq response did not contain generated content."
    );
  }

  return output;
}

async function executeHttpRequest(
  config: Record<string, any>,
  input: string,
  previousOutput: string
) {
  if (!config?.url) {
    throw new Error(
      "HTTP Request step requires a URL."
    );
  }

  const method =
    config?.method || "GET";

  const replaceVariables = (value: any): any => {
    if (typeof value === "string") {
      return value
        .replace(
          /\{\{\s*input\s*\}\}/gi,
          input
        )
        .replace(
          /\{\{\s*previous_output\s*\}\}/gi,
          previousOutput
        );
    }

    if (Array.isArray(value)) {
      return value.map(replaceVariables);
    }

    if (
      value &&
      typeof value === "object"
    ) {
      return Object.fromEntries(
        Object.entries(value).map(
          ([key, val]) => [
            key,
            replaceVariables(val),
          ]
        )
      );
    }

    return value;
  };

  const headers =
    replaceVariables(
      config?.headers || {}
    );

  const body =
    replaceVariables(
      config?.body
    );

  const requestOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (
    method !== "GET" &&
    method !== "HEAD" &&
    body !== undefined
  ) {
    requestOptions.body =
      typeof body === "string"
        ? body
        : JSON.stringify(body);
  }

  const response = await fetch(
    config.url,
    requestOptions
  );

  const responseText =
    await response.text();

  let parsed: any = responseText;

  try {
    parsed = JSON.parse(responseText);
  } catch {
    // Keep plain text.
  }

  if (!response.ok) {
    throw new Error(
      `HTTP request failed with status ${response.status}.`
    );
  }

  return parsed;
}

function evaluateCondition(
  condition: string,
  result: any
) {
  if (!condition) {
    return true;
  }

  /*
   * Safe support for the common workflow
   * condition examples.
   */

  const lengthMatch =
    condition.match(
      /^result\.length\s*(>|>=|<|<=|===|==|!==|!=)\s*(\d+)$/
    );

  if (lengthMatch) {
    const [, operator, rawNumber] =
      lengthMatch;

    const number =
      Number(rawNumber);

    const length =
      typeof result === "string" ||
      Array.isArray(result)
        ? result.length
        : String(result ?? "").length;

    switch (operator) {
      case ">":
        return length > number;

      case ">=":
        return length >= number;

      case "<":
        return length < number;

      case "<=":
        return length <= number;

      case "===":
      case "==":
        return length === number;

      case "!==":
      case "!=":
        return length !== number;

      default:
        return false;
    }
  }

  const equalsMatch =
    condition.match(
      /^result\s*(===|==|!==|!=)\s*["'](.*)["']$/
    );

  if (equalsMatch) {
    const [, operator, value] =
      equalsMatch;

    const resultString =
      String(result ?? "");

    if (
      operator === "===" ||
      operator === "=="
    ) {
      return resultString === value;
    }

    return resultString !== value;
  }

  /*
   * Basic truthiness condition.
   */
  if (
    condition.trim() === "result"
  ) {
    return Boolean(result);
  }

  /*
   * Don't execute arbitrary JavaScript
   * supplied by the user.
   */
  return Boolean(result);
}

async function executeStep(
  step: WorkflowStep,
  input: string,
  previousOutput: string
) {
  const config =
    step.config || {};

  switch (step.type) {
    case "llm_call": {
      const output =
        await callGroq(
          config,
          input,
          previousOutput
        );

      return {
        output,
        nextStep: null,
        status: "completed",
      };
    }

    case "http_request": {
      const output =
        await executeHttpRequest(
          config,
          input,
          previousOutput
        );

      return {
        output,
        nextStep: null,
        status: "completed",
      };
    }

    case "conditional_branch": {
      const conditionResult =
        evaluateCondition(
          config?.condition,
          previousOutput
        );

      return {
        output:
          previousOutput,
        nextStep: conditionResult
          ? config?.true_step ?? null
          : config?.false_step ?? null,
        status: "completed",
        conditionResult,
      };
    }

    case "approval_gate": {
      /*
       * For now the execution pauses here.
       * A future approval UI can resume the run.
       */
      return {
        output:
          previousOutput,
        nextStep: null,
        status: "waiting_for_approval",
        approval: {
          title:
            config?.title ||
            "Approval required",
          message:
            config?.message ||
            "Please review this result.",
          approver:
            config?.approver ||
            null,
          timeout_hours:
            config?.timeout_hours ||
            24,
        },
      };
    }

    case "notify": {
      /*
       * Notification execution can be
       * connected to your notification provider
       * later. For now it records the step.
       */
      return {
        output:
          previousOutput,
        nextStep: null,
        status: "completed",
        notification: config,
      };
    }

    case "db_write": {
      /*
       * Database write execution depends on
       * your exact database schema.
       */
      return {
        output:
          previousOutput,
        nextStep: null,
        status: "completed",
        databaseWrite: config,
      };
    }

    default:
      throw new Error(
        `Unsupported workflow step type: ${step.type}`
      );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as ExecuteRequest;

    const workflowId =
      body?.workflowId || null;

    const steps =
      Array.isArray(body?.steps)
        ? [...body.steps].sort(
            (a, b) =>
              a.step_order -
              b.step_order
          )
        : [];

    const input =
      typeof body?.input === "string"
        ? body.input
        : "";

    if (steps.length === 0) {
      return jsonResponse(
        {
          success: false,
          error:
            "No workflow steps were provided.",
        },
        400
      );
    }

    const executionId =
      crypto.randomUUID();

    const startedAt =
      new Date().toISOString();

    const results: any[] = [];

    let currentIndex = 0;
    let previousOutput = input;

    const maxIterations =
      Math.max(
        steps.length * 3,
        10
      );

    let iterations = 0;

    while (
      currentIndex >= 0 &&
      currentIndex < steps.length
    ) {
      iterations++;

      if (
        iterations > maxIterations
      ) {
        throw new Error(
          "Workflow exceeded the maximum execution iterations. Check your conditional branches."
        );
      }

      const step =
        steps[currentIndex];

      const stepStartedAt =
        new Date().toISOString();

      try {
        const result =
          await executeStep(
            step,
            input,
            previousOutput
          );

        const stepFinishedAt =
          new Date().toISOString();

        results.push({
          stepId:
            step.id || null,
          stepOrder:
            step.step_order,
          stepName:
            step.name,
          type:
            step.type,
          status:
            result.status,
          output:
            result.output,
          conditionResult:
            result.conditionResult,
          approval:
            result.approval,
          startedAt:
            stepStartedAt,
          finishedAt:
            stepFinishedAt,
        });

        if (
          result.status ===
          "waiting_for_approval"
        ) {
          return jsonResponse({
            success: true,
            executionId,
            workflowId,
            status:
              "waiting_for_approval",
            output:
              result.output,
            results,
            startedAt,
            finishedAt:
              new Date().toISOString(),
          });
        }

        if (
          result.output !==
          undefined
        ) {
          previousOutput =
            typeof result.output ===
            "string"
              ? result.output
              : JSON.stringify(
                  result.output
                );
        }

        /*
         * Conditional branch targets are
         * 1-based step numbers in the builder.
         */
        if (
          result.nextStep !== null &&
          result.nextStep !==
            undefined &&
          result.nextStep !== ""
        ) {
          const target =
            Number(
              result.nextStep
            );

          if (
            Number.isInteger(
              target
            ) &&
            target >= 1 &&
            target <= steps.length
          ) {
            currentIndex =
              target - 1;
            continue;
          }
        }

        currentIndex++;
      } catch (stepError: any) {
        results.push({
          stepId:
            step.id || null,
          stepOrder:
            step.step_order,
          stepName:
            step.name,
          type:
            step.type,
          status: "failed",
          error:
            stepError?.message ||
            String(stepError),
          startedAt:
            stepStartedAt,
          finishedAt:
            new Date().toISOString(),
        });

        return jsonResponse(
          {
            success: false,
            executionId,
            workflowId,
            status: "failed",
            error:
              stepError?.message ||
              String(stepError),
            results,
            startedAt,
            finishedAt:
              new Date().toISOString(),
          },
          500
        );
      }
    }

    return jsonResponse({
      success: true,
      executionId,
      workflowId,
      status: "completed",
      input,
      output: previousOutput,
      results,
      startedAt,
      finishedAt:
        new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(
      "Workflow execution error:",
      error
    );

    return jsonResponse(
      {
        success: false,
        status: "failed",
        error:
          error?.message ||
          "Workflow execution failed.",
      },
      500
    );
  }
}