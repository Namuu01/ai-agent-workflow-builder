from typing import Any

from .types import WorkflowStep, WorkflowResult
from .step_executor import StepExecutor
from app.services.hasura.client import HasuraClient


class WorkflowEngine:

    def __init__(self):
        self.step_executor = StepExecutor()
        self.hasura = HasuraClient()

    # ============================================================
    # EXECUTE NEW WORKFLOW
    # ============================================================

    async def execute(
        self,
        workflow_id: str,
        steps: list[WorkflowStep],
        organization_id: str | None = None,
        context: dict[str, Any] | None = None,
    ) -> WorkflowResult:

        context = context or {}

        # --------------------------------------------------------
        # QUOTA CHECK
        # --------------------------------------------------------

        if organization_id:

            usage = await self.hasura.get_organization_usage(
                organization_id
            )

            if usage["quota_remaining"] <= 0:

                return WorkflowResult(
                    workflow_id=workflow_id,
                    workflow_run_id=None,
                    status="failed",
                    steps=[],
                    error=(
                        "Organization quota exceeded. "
                        "No workflow executions remaining."
                    ),
                )

        # --------------------------------------------------------
        # CREATE WORKFLOW RUN
        # --------------------------------------------------------

        run = await self.hasura.create_workflow_run(
            workflow_id=workflow_id,
            org_id=organization_id,
        )

        workflow_run_id = run["id"]

        # --------------------------------------------------------
        # EXECUTE STEPS
        # --------------------------------------------------------

        return await self._execute_steps(
            workflow_id=workflow_id,
            workflow_run_id=workflow_run_id,
            steps=steps,
            organization_id=organization_id,
            start_index=0,
            context=context,
        )

    # ============================================================
    # RESUME WORKFLOW AFTER APPROVAL
    # ============================================================

    async def resume(
        self,
        workflow_run_id: str,
    ) -> WorkflowResult:

        # --------------------------------------------------------
        # GET WORKFLOW RUN
        # --------------------------------------------------------

        run = await self.hasura.get_workflow_run(
            workflow_run_id
        )

        workflow_id = run["workflow_id"]

        organization_id = run.get("org_id")

        # --------------------------------------------------------
        # GET WORKFLOW STEPS
        # --------------------------------------------------------

        db_steps = await self.hasura.get_workflow_steps(
            workflow_id
        )

        steps: list[WorkflowStep] = []

        for row in db_steps:

            steps.append(
                WorkflowStep(
                    id=row["id"],
                    workflow_id=row["workflow_id"],
                    step_order=row["step_order"],
                    name=row.get("name", ""),
                    type=row["type"],
                    config=row.get("config", {}) or {},
                )
            )

        # --------------------------------------------------------
        # GET APPROVALS FOR THIS RUN
        # --------------------------------------------------------

        approvals = await self.hasura.get_workflow_approvals_for_run(
            workflow_run_id
        )

        approved_step_id = None

        for approval in approvals:

            if approval["status"] == "approved":

                approved_step_id = approval["step_id"]

        # --------------------------------------------------------
        # SORT STEPS
        # --------------------------------------------------------

        ordered_steps = sorted(
            steps,
            key=lambda step: step.step_order,
        )

        # --------------------------------------------------------
        # BUILD PREVIOUS RESULTS
        # --------------------------------------------------------

        previous_results = []

        if approved_step_id:

            for approval in approvals:

                if (
                    approval["status"] == "approved"
                    and approval["step_id"] == approved_step_id
                ):

                    previous_results.append(
                        type(
                            "WorkflowStepResult",
                            (),
                            {
                                "step_id":
                                    approval["step_id"],

                                "status":
                                    "approved",

                                "output": {
                                    "message":
                                        approval.get(
                                            "message",
                                            "Workflow approved.",
                                        ),

                                    "approval_id":
                                        approval["id"],
                                },

                                "error":
                                    None,

                                "attempts":
                                    1,
                            },
                        )()
                    )

                    break

        # --------------------------------------------------------
        # FIND NEXT STEP
        # --------------------------------------------------------

        start_index = 0

        if approved_step_id:

            for index, step in enumerate(
                ordered_steps
            ):

                if step.id == approved_step_id:

                    start_index = index + 1

                    break

        # --------------------------------------------------------
        # NO MORE STEPS
        # --------------------------------------------------------

        if start_index >= len(ordered_steps):

            if organization_id:

                await self.hasura.increment_quota(
                    organization_id=organization_id,
                    amount=1,
                )

            await self.hasura.update_workflow_run(
                workflow_run_id=workflow_run_id,
                status="completed",
            )

            return WorkflowResult(
                workflow_id=workflow_id,

                workflow_run_id=workflow_run_id,

                status="completed",

                steps=previous_results,

                error=None,
            )

        # --------------------------------------------------------
        # EXECUTE REMAINING STEPS
        # --------------------------------------------------------

        result = await self._execute_steps(
            workflow_id=workflow_id,

            workflow_run_id=workflow_run_id,

            steps=ordered_steps,

            organization_id=organization_id,

            start_index=start_index,

            context={},
        )

        # --------------------------------------------------------
        # COMBINE APPROVED STEP + REMAINING STEPS
        # --------------------------------------------------------

        result.steps = (
            previous_results
            + result.steps
        )

        return result

    # ============================================================
    # INTERNAL EXECUTION
    # ============================================================

    async def _execute_steps(
        self,
        workflow_id: str,
        workflow_run_id: str,
        steps: list[WorkflowStep],
        organization_id: str | None,
        start_index: int = 0,
        context: dict[str, Any] | None = None,
    ) -> WorkflowResult:

        context = context or {}

        ordered_steps = sorted(
            steps,
            key=lambda step: step.step_order,
        )

        results = []

        # --------------------------------------------------------
        # EXECUTE STEPS
        # --------------------------------------------------------

        for step in ordered_steps[start_index:]:

            max_retries = step.config.get(
                "max_retries",
                0,
            )

            if (
                not isinstance(max_retries, int)
                or max_retries < 0
            ):

                max_retries = 0

            attempt = 0

            result = None

            # ----------------------------------------------------
            # RETRIES
            # ----------------------------------------------------

            while attempt <= max_retries:

                result = await self.step_executor.execute(
                    step,
                    context,
                )

                if result.status != "failed":

                    break

                if attempt >= max_retries:

                    break

                attempt += 1

            # ----------------------------------------------------
            # STORE RESULT
            # ----------------------------------------------------

            step_result = type(
                "WorkflowStepResult",
                (),
                {
                    "step_id":
                        step.id,

                    "status":
                        result.status,

                    "output":
                        result.output,

                    "error":
                        result.error,

                    "attempts":
                        attempt + 1,
                },
            )()

            results.append(
                step_result
            )

            # ----------------------------------------------------
            # UPDATE CONTEXT
            # ----------------------------------------------------

            context[step.id] = {
                "status":
                    result.status,

                "output":
                    result.output,

                "error":
                    result.error,

                "attempts":
                    attempt + 1,
            }

            # ----------------------------------------------------
            # FAILED
            # ----------------------------------------------------

            if result.status == "failed":

                await self.hasura.update_workflow_run(
                    workflow_run_id=
                        workflow_run_id,

                    status="failed",

                    error=result.error,
                )

                return WorkflowResult(
                    workflow_id=workflow_id,

                    workflow_run_id=
                        workflow_run_id,

                    status="failed",

                    steps=results,

                    error=result.error,
                )

            # ----------------------------------------------------
            # APPROVAL GATE
            # ----------------------------------------------------

            if (
                step.type == "approval_gate"
                and result.status == "pending"
            ):

                message = step.config.get(
                    "message",
                    "Approval required to continue workflow.",
                )

                approval = (
                    await self.hasura.create_workflow_approval(
                        workflow_run_id=
                            workflow_run_id,

                        workflow_id=
                            workflow_id,

                        step_id=
                            step.id,

                        org_id=
                            organization_id,

                        message=
                            message,
                    )
                )

                result.output = {
                    "message":
                        message,

                    "approval_id":
                        approval["id"],
                }

                results[-1].output = (
                    result.output
                )

                await self.hasura.update_workflow_run(
                    workflow_run_id=
                        workflow_run_id,

                    status="pending",
                )

                return WorkflowResult(
                    workflow_id=
                        workflow_id,

                    workflow_run_id=
                        workflow_run_id,

                    status="pending",

                    steps=results,

                    error=None,
                )

            # ----------------------------------------------------
            # CONDITION FALSE
            # ----------------------------------------------------

            if (
                step.type == "condition"
                and result.output is False
            ):

                if organization_id:

                    await self.hasura.increment_quota(
                        organization_id=
                            organization_id,

                        amount=1,
                    )

                await self.hasura.update_workflow_run(
                    workflow_run_id=
                        workflow_run_id,

                    status="completed",
                )

                return WorkflowResult(
                    workflow_id=
                        workflow_id,

                    workflow_run_id=
                        workflow_run_id,

                    status="completed",

                    steps=results,

                    error=None,
                )

        # --------------------------------------------------------
        # WORKFLOW COMPLETED
        # --------------------------------------------------------

        if organization_id:

            await self.hasura.increment_quota(
                organization_id=
                    organization_id,

                amount=1,
            )

        await self.hasura.update_workflow_run(
            workflow_run_id=
                workflow_run_id,

            status="completed",
        )

        return WorkflowResult(
            workflow_id=
                workflow_id,

            workflow_run_id=
                workflow_run_id,

            status="completed",

            steps=results,

            error=None,
        )
