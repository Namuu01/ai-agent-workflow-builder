import os
from typing import Any

import httpx

from .types import WorkflowStep


class StepExecutor:

    async def execute(
        self,
        step: WorkflowStep,
        context: dict[str, Any] | None = None,
    ):
        context = context or {}

        try:

            # ====================================================
            # HTTP REQUEST
            # ====================================================

            if step.type == "http_request":

                return await self._execute_http(
                    step,
                    context,
                )

            # ====================================================
            # LLM CALL
            # ====================================================

            if step.type == "llm_call":

                return await self._execute_llm(
                    step,
                    context,
                )

            # ====================================================
            # APPROVAL GATE
            # ====================================================

            if step.type == "approval_gate":

                return self._pending_result(
                    message=step.config.get(
                        "message",
                        "Approval required to continue workflow.",
                    )
                )

            # ====================================================
            # CONDITION
            # ====================================================

            if step.type == "condition":

                return self._execute_condition(
                    step,
                    context,
                )

            # ====================================================
            # UNSUPPORTED
            # ====================================================

            return self._failed_result(
                f"Unsupported step type: {step.type}"
            )

        except Exception as exc:

            return self._failed_result(
                str(exc)
            )

    # ============================================================
    # HTTP REQUEST
    # ============================================================

    async def _execute_http(
        self,
        step: WorkflowStep,
        context: dict[str, Any],
    ):

        config = step.config or {}

        url = config.get("url")

        if not url:

            return self._failed_result(
                "HTTP request requires a URL."
            )

        method = str(
            config.get(
                "method",
                "GET",
            )
        ).upper()

        headers = config.get(
            "headers",
            {},
        )

        params = config.get(
            "params",
            {},
        )

        body = config.get(
            "body"
        )

        timeout = config.get(
            "timeout",
            30,
        )

        async with httpx.AsyncClient(
            timeout=timeout
        ) as client:

            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=body,
            )

        if response.status_code >= 400:

            return self._failed_result(
                f"HTTP {response.status_code}: "
                f"{response.text[:1000]}"
            )

        try:

            response_data = response.json()

        except Exception:

            response_data = response.text

        return self._success_result(
            output={
                "status_code":
                    response.status_code,

                "headers":
                    dict(response.headers),

                "body":
                    response_data,
            }
        )

    # ============================================================
    # GROQ LLM
    # ============================================================

    async def _execute_llm(
        self,
        step: WorkflowStep,
        context: dict[str, Any],
    ):

        config = step.config or {}

        # --------------------------------------------------------
        # PROMPT
        # --------------------------------------------------------

        prompt = str(
            config.get(
                "prompt",
                "",
            )
        ).strip()

        if not prompt:

            return self._failed_result(
                "LLM step requires a prompt."
            )

        # --------------------------------------------------------
        # GROQ API KEY
        # --------------------------------------------------------

        api_key = os.getenv(
            "GROQ_API_KEY"
        )

        if not api_key:

            return self._failed_result(
                "GROQ_API_KEY environment variable is not set."
            )

        # --------------------------------------------------------
        # MODEL
        # --------------------------------------------------------

        model = config.get(
            "model",
            "llama-3.1-8b-instant",
        )

        # --------------------------------------------------------
        # TEMPERATURE
        # --------------------------------------------------------

        temperature = config.get(
            "temperature",
            0.2,
        )

        # --------------------------------------------------------
        # MAX TOKENS
        # --------------------------------------------------------

        max_tokens = config.get(
            "max_tokens",
            500,
        )

        # --------------------------------------------------------
        # WEBHOOK DATA
        # --------------------------------------------------------

        webhook_data = context.get(
            "webhook",
            context,
        )

        # --------------------------------------------------------
        # FINAL PROMPT
        # --------------------------------------------------------

        final_prompt = f"""
{prompt}

Webhook data:
{webhook_data}
""".strip()

        # --------------------------------------------------------
        # GROQ REQUEST
        # --------------------------------------------------------

        headers = {
            "Authorization":
                f"Bearer {api_key}",

            "Content-Type":
                "application/json",
        }

        payload = {

            "model":
                model,

            "messages": [

                {
                    "role":
                        "user",

                    "content":
                        final_prompt,
                }

            ],

            "temperature":
                temperature,

            "max_tokens":
                max_tokens,
        }

        async with httpx.AsyncClient(
            timeout=60.0
        ) as client:

            response = await client.post(

                "https://api.groq.com/openai/v1/chat/completions",

                headers=headers,

                json=payload,
            )

        # --------------------------------------------------------
        # GROQ ERROR
        # --------------------------------------------------------

        if response.status_code >= 400:

            return self._failed_result(
                f"Groq API error "
                f"{response.status_code}: "
                f"{response.text[:1000]}"
            )

        # --------------------------------------------------------
        # PARSE RESPONSE
        # --------------------------------------------------------

        try:

            data = response.json()

        except Exception as exc:

            return self._failed_result(
                f"Invalid Groq response: {exc}"
            )

        # --------------------------------------------------------
        # EXTRACT LLM RESPONSE
        # --------------------------------------------------------

        try:

            llm_response = (
                data[
                    "choices"
                ][0][
                    "message"
                ][
                    "content"
                ]
            )

        except (
            KeyError,
            IndexError,
            TypeError,
        ):

            return self._failed_result(
                f"Invalid Groq response format: {data}"
            )

        # --------------------------------------------------------
        # SUCCESS
        # --------------------------------------------------------

        return self._success_result(

            output={

                "prompt":
                    final_prompt,

                "response":
                    llm_response,

                "model":
                    model,
            }
        )

    # ============================================================
    # CONDITION
    # ============================================================

    def _execute_condition(
        self,
        step: WorkflowStep,
        context: dict[str, Any],
    ):

        config = step.config or {}

        value = config.get(
            "value"
        )

        expected = config.get(
            "equals"
        )

        result = value == expected

        return self._success_result(
            output=result
        )

    # ============================================================
    # SUCCESS RESULT
    # ============================================================

    def _success_result(
        self,
        output: Any = None,
    ):

        return type(
            "StepExecutionResult",
            (),
            {

                "status":
                    "completed",

                "output":
                    output,

                "error":
                    None,

            },
        )()

    # ============================================================
    # PENDING RESULT
    # ============================================================

    def _pending_result(
        self,
        message: str,
    ):

        return type(
            "StepExecutionResult",
            (),
            {

                "status":
                    "pending",

                "output": {

                    "message":
                        message

                },

                "error":
                    None,

            },
        )()

    # ============================================================
    # FAILED RESULT
    # ============================================================

    def _failed_result(
        self,
        error: str,
    ):

        return type(
            "StepExecutionResult",
            (),
            {

                "status":
                    "failed",

                "output":
                    None,

                "error":
                    error,

            },
        )()
