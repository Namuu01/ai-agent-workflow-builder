from typing import Any

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel

from app.services.executor.engine import WorkflowEngine
from app.services.executor.types import WorkflowStep
from app.services.hasura.client import HasuraClient


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="AI Agent Workflow Builder"
)


# ============================================================
# REQUEST MODELS
# ============================================================

class WebhookRequest(BaseModel):
    data: dict[str, Any] = {}


class ApproveStepRequest(BaseModel):
    approval_id: str


class ApproveStepResponse(BaseModel):
    success: bool
    message: str
    approval: dict
    workflow: dict


# ============================================================
# TEST DATA
# ============================================================

ORGANIZATION_ID = (
    "af92af8f-5dc5-4613-bc5d-cc75b190d0b4"
)

WORKFLOW_ID = (
    "f24bafea-7add-4b4e-8588-a9c8a35c560e"
)

APPROVAL_STEP_ID = (
    "93136f36-5c6d-4bac-a9ca-48f888637d45"
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
async def root():

    return {
        "message": "Workflow Builder Backend is running"
    }


# ============================================================
# TEST WORKFLOW EXECUTOR
# ============================================================

@app.post("/test-executor")
async def test_executor():

    try:

        steps = [
            WorkflowStep(
                id=APPROVAL_STEP_ID,

                workflow_id=WORKFLOW_ID,

                step_order=2,

                name="approval test",

                type="approval_gate",

                config={
                    "message":
                        "Please approve this workflow."
                },
            )
        ]

        engine = WorkflowEngine()

        result = await engine.execute(
            workflow_id=WORKFLOW_ID,
            steps=steps,
            organization_id=ORGANIZATION_ID,
        )

        return {
            "organization_id":
                ORGANIZATION_ID,

            "workflow_id":
                result.workflow_id,

            "workflow_run_id":
                result.workflow_run_id,

            "status":
                result.status,

            "steps": [
                {
                    "step_id":
                        step.step_id,

                    "status":
                        step.status,

                    "output":
                        step.output,

                    "error":
                        step.error,

                    "attempts":
                        step.attempts,
                }

                for step in result.steps
            ],

            "error":
                result.error,
        }

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# TEST QUOTA
# ============================================================

@app.get("/test-quota")
async def test_quota():

    try:

        hasura = HasuraClient()

        usage = await hasura.get_organization_usage(
            ORGANIZATION_ID
        )

        return {
            "organization_id":
                ORGANIZATION_ID,

            "quota_allowed":
                usage["quota_allowed"],

            "quota_used":
                usage["quota_used"],

            "quota_remaining":
                usage["quota_remaining"],

            "quota_percentage":
                usage["quota_percentage"],
        }

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# TEST INCREMENT QUOTA
# ============================================================

@app.get("/test-increment-quota")
async def test_increment_quota():

    try:

        hasura = HasuraClient()

        updated = await hasura.increment_quota(
            organization_id=ORGANIZATION_ID,
            amount=1,
        )

        return {
            "organization_id":
                updated["id"],

            "name":
                updated["name"],

            "quota_allowed":
                updated["quota_allowed"],

            "quota_used":
                updated["quota_used"],
        }

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# GET APPROVAL
# ============================================================

@app.get("/approvals/{approval_id}")
async def get_approval(
    approval_id: str,
):

    try:

        hasura = HasuraClient()

        approval = await hasura.get_workflow_approval(
            approval_id
        )

        return {
            "success": True,
            "approval": approval,
        }

    except Exception as exc:

        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )


# ============================================================
# APPROVE STEP LOGIC
# ============================================================

async def approve_step_logic(
    approval_id: str,
):

    hasura = HasuraClient()

    # --------------------------------------------------------
    # GET APPROVAL
    # --------------------------------------------------------

    approval = await hasura.get_workflow_approval(
        approval_id
    )

    # --------------------------------------------------------
    # ALREADY APPROVED
    # --------------------------------------------------------

    if approval["status"] == "approved":

        return {
            "success": True,

            "message":
                "Workflow approval was already approved.",

            "approval":
                approval,

            "workflow": {
                "workflow_id":
                    approval["workflow_id"],

                "status":
                    "completed",

                "steps":
                    [],

                "error":
                    None,
            },
        }

    # --------------------------------------------------------
    # ALREADY REJECTED
    # --------------------------------------------------------

    if approval["status"] == "rejected":

        raise HTTPException(
            status_code=409,
            detail=(
                "This workflow approval "
                "has already been rejected."
            ),
        )

    # --------------------------------------------------------
    # APPROVE
    # --------------------------------------------------------

    updated = await hasura.approve_workflow_approval(
        approval_id=approval_id,
        decided_by=None,
    )

    # --------------------------------------------------------
    # RESUME WORKFLOW
    # --------------------------------------------------------

    engine = WorkflowEngine()

    result = await engine.resume(
        workflow_run_id=
            updated["workflow_run_id"]
    )

    # --------------------------------------------------------
    # WORKFLOW RESPONSE
    # --------------------------------------------------------

    workflow = {
        "workflow_id":
            result.workflow_id,

        "status":
            result.status,

        "steps": [
            {
                "step_id":
                    step.step_id,

                "status":
                    step.status,

                "output":
                    step.output,

                "error":
                    step.error,

                "attempts":
                    step.attempts,
            }

            for step in result.steps
        ],

        "error":
            result.error,
    }

    return {
        "success": True,

        "message":
            "Workflow approved and resumed.",

        "approval":
            updated,

        "workflow":
            workflow,
    }


# ============================================================
# APPROVE WORKFLOW
# ============================================================

@app.post(
    "/approvals/{approval_id}/approve"
)
async def approve_workflow(
    approval_id: str,
):

    try:

        return await approve_step_logic(
            approval_id
        )

    except HTTPException:
        raise

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# HASURA ACTION: APPROVE STEP
# ============================================================

@app.post(
    "/actions/approve-step",
    response_model=ApproveStepResponse,
)
async def approve_step_action(
    request: ApproveStepRequest,
):

    try:

        return await approve_step_logic(
            request.approval_id
        )

    except HTTPException:
        raise

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# REJECT WORKFLOW
# ============================================================

@app.post(
    "/approvals/{approval_id}/reject"
)
async def reject_workflow(
    approval_id: str,
):

    try:

        hasura = HasuraClient()

        # ----------------------------------------------------
        # GET APPROVAL
        # ----------------------------------------------------

        approval = await hasura.get_workflow_approval(
            approval_id
        )

        # ----------------------------------------------------
        # MUST BE PENDING
        # ----------------------------------------------------

        if approval["status"] != "pending":

            raise HTTPException(
                status_code=409,
                detail=(
                    "This workflow approval "
                    "has already been decided."
                ),
            )

        # ----------------------------------------------------
        # REJECT
        # ----------------------------------------------------

        updated = await hasura.reject_workflow_approval(
            approval_id=approval_id,
            decided_by=None,
        )

        # ----------------------------------------------------
        # MARK RUN FAILED
        # ----------------------------------------------------

        await hasura.update_workflow_run(
            workflow_run_id=
                updated["workflow_run_id"],

            status="failed",

            error=
                "Workflow approval rejected.",
        )

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return {
            "success": True,

            "message":
                "Workflow approval rejected.",

            "approval":
                updated,

            "workflow_status":
                "failed",
        }

    except HTTPException:
        raise

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# WEBHOOK TRIGGER
# ============================================================
#
# IMPORTANT:
# There must be ONLY ONE endpoint for:
#
# POST /webhooks/{workflow_id}
#
# ============================================================

@app.post("/webhooks/{workflow_id}")
async def webhook_trigger(
    workflow_id: str,
    request: Request,
):

    try:

        # ----------------------------------------------------
        # READ WEBHOOK PAYLOAD
        # ----------------------------------------------------

        payload: dict[str, Any] = await request.json()

        # ----------------------------------------------------
        # HASURA
        # ----------------------------------------------------

        hasura = HasuraClient()

        # ----------------------------------------------------
        # GET WORKFLOW
        # ----------------------------------------------------

        workflow = await hasura.get_workflow(
            workflow_id
        )

        organization_id = workflow.get(
            "org_id"
        )

        if not organization_id:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Workflow does not have "
                    "an organization ID."
                ),
            )

        # ----------------------------------------------------
        # GET WORKFLOW STEPS
        # ----------------------------------------------------

        db_steps = await hasura.get_workflow_steps(
            workflow_id
        )

        if not db_steps:

            raise HTTPException(
                status_code=404,
                detail=(
                    "No workflow steps found "
                    f"for workflow {workflow_id}"
                ),
            )

        # ----------------------------------------------------
        # CONVERT DATABASE STEPS
        # ----------------------------------------------------

        steps: list[WorkflowStep] = []

        for row in db_steps:

            steps.append(
                WorkflowStep(
                    id=row["id"],

                    workflow_id=row["workflow_id"],

                    step_order=row["step_order"],

                    name=row.get(
                        "name",
                        "",
                    ),

                    type=row["type"],

                    config=row.get(
                        "config",
                        {},
                    ) or {},
                )
            )

        # ----------------------------------------------------
        # EXECUTE WORKFLOW
        # ----------------------------------------------------

        engine = WorkflowEngine()

        result = await engine.execute(
            workflow_id=workflow_id,

            steps=steps,

            organization_id=organization_id,

            context={
                "webhook": payload,
            },
        )

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return {
            "success": True,

            "organization_id":
                organization_id,

            "workflow_id":
                result.workflow_id,

            "workflow_run_id":
                result.workflow_run_id,

            "status":
                result.status,

            "steps": [
                {
                    "step_id":
                        step.step_id,

                    "status":
                        step.status,

                    "output":
                        step.output,

                    "error":
                        step.error,

                    "attempts":
                        step.attempts,
                }

                for step in result.steps
            ],

            "error":
                result.error,
        }

    except HTTPException:
        raise

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )
