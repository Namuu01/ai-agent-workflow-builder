from dataclasses import dataclass, field
from typing import Any


# ============================================================
# WORKFLOW STEP
# ============================================================

@dataclass
class WorkflowStep:
    id: str
    workflow_id: str
    step_order: int
    name: str
    type: str
    config: dict[str, Any] = field(default_factory=dict)


# ============================================================
# WORKFLOW STEP RESULT
# ============================================================

@dataclass
class WorkflowStepResult:
    step_id: str
    status: str
    output: Any = None
    error: str | None = None
    attempts: int = 1


# ============================================================
# WORKFLOW RESULT
# ============================================================

@dataclass
class WorkflowResult:
    workflow_id: str
    status: str

    steps: list[WorkflowStepResult] = field(
        default_factory=list
    )

    error: str | None = None

    # Workflow run created in Hasura
    workflow_run_id: str | None = None
