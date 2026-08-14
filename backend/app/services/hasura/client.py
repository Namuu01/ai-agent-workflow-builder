import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()


class HasuraClient:

    def __init__(self):
        self.url = os.getenv("HASURA_URL")
        self.admin_secret = os.getenv("HASURA_ADMIN_SECRET")

        if not self.url:
            raise RuntimeError(
                "HASURA_URL environment variable is not set."
            )

    # ============================================================
    # HASURA REQUEST
    # ============================================================

    async def _request(
        self,
        query: str,
        variables: dict[str, Any] | None = None,
    ):
        headers = {
            "Content-Type": "application/json",
        }

        if self.admin_secret:
            headers["x-hasura-admin-secret"] = self.admin_secret

        payload = {
            "query": query,
            "variables": variables or {},
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.url,
                json=payload,
                headers=headers,
            )

        if response.status_code != 200:
            raise RuntimeError(
                f"Hasura HTTP error {response.status_code}: "
                f"{response.text}"
            )

        data = response.json()

        if data.get("errors"):
            raise RuntimeError(
                f"Hasura GraphQL error: {data['errors']}"
            )

        return data.get("data") or {}

    # ============================================================
    # GET WORKFLOW
    # ============================================================

    async def get_workflow(
        self,
        workflow_id: str,
    ):
        query = """
        query GetWorkflow($id: uuid!) {

          workflows_by_pk(id: $id) {

            id
            org_id
            name

          }

        }
        """

        data = await self._request(
            query,
            {
                "id": workflow_id,
            },
        )

        workflow = data.get("workflows_by_pk")

        if not workflow:
            raise RuntimeError(
                f"Workflow not found: {workflow_id}"
            )

        return workflow

    # ============================================================
    # ORGANIZATION QUOTA
    # ============================================================

    async def get_organization_usage(
        self,
        organization_id: str,
    ):
        query = """
        query GetOrganization($id: uuid!) {

          organizations_by_pk(id: $id) {

            id
            name
            quota_allowed
            quota_used

          }

        }
        """

        data = await self._request(
            query,
            {
                "id": organization_id,
            },
        )

        organization = data.get(
            "organizations_by_pk"
        )

        if not organization:
            raise RuntimeError(
                f"Organization not found: {organization_id}"
            )

        allowed = organization.get(
            "quota_allowed"
        ) or 0

        used = organization.get(
            "quota_used"
        ) or 0

        remaining = max(
            allowed - used,
            0,
        )

        percentage = (
            (used / allowed) * 100
            if allowed > 0
            else 0
        )

        return {
            "id": organization["id"],
            "name": organization.get("name"),
            "quota_allowed": allowed,
            "quota_used": used,
            "quota_remaining": remaining,
            "quota_percentage": percentage,
        }

    # ============================================================
    # INCREMENT QUOTA
    # ============================================================

    async def increment_quota(
        self,
        organization_id: str,
        amount: int = 1,
    ):
        mutation = """
        mutation IncrementQuota(
          $id: uuid!
          $amount: Int!
        ) {

          update_organizations_by_pk(
            pk_columns: {
              id: $id
            }

            _inc: {
              quota_used: $amount
            }

          ) {

            id
            name
            quota_allowed
            quota_used

          }

        }
        """

        data = await self._request(
            mutation,
            {
                "id": organization_id,
                "amount": amount,
            },
        )

        organization = data.get(
            "update_organizations_by_pk"
        )

        if not organization:
            raise RuntimeError(
                "Unable to increment organization quota."
            )

        return organization

    # ============================================================
    # CREATE WORKFLOW RUN
    # ============================================================

    async def create_workflow_run(
        self,
        workflow_id: str,
        org_id: str,
    ):
        mutation = """
        mutation CreateWorkflowRun(
          $workflow_id: uuid!
          $org_id: uuid!
        ) {

          insert_workflow_runs_one(

            object: {
              workflow_id: $workflow_id
              org_id: $org_id
              status: "running"
            }

          ) {

            id
            workflow_id
            org_id
            status

          }

        }
        """

        data = await self._request(
            mutation,
            {
                "workflow_id": workflow_id,
                "org_id": org_id,
            },
        )

        run = data.get(
            "insert_workflow_runs_one"
        )

        if not run:
            raise RuntimeError(
                "Unable to create workflow run."
            )

        return run

    # ============================================================
    # GET WORKFLOW RUN
    # ============================================================

    async def get_workflow_run(
        self,
        workflow_run_id: str,
    ):
        query = """
        query GetWorkflowRun($id: uuid!) {

          workflow_runs_by_pk(id: $id) {

            id
            workflow_id
            org_id
            status
            error

          }

        }
        """

        data = await self._request(
            query,
            {
                "id": workflow_run_id,
            },
        )

        run = data.get(
            "workflow_runs_by_pk"
        )

        if not run:
            raise RuntimeError(
                f"Workflow run not found: {workflow_run_id}"
            )

        return run

    # ============================================================
    # UPDATE WORKFLOW RUN
    # ============================================================

    async def update_workflow_run(
        self,
        workflow_run_id: str,
        status: str,
        error: str | None = None,
    ):
        mutation = """
        mutation UpdateWorkflowRun(
          $id: uuid!
          $status: String!
          $error: String
        ) {

          update_workflow_runs_by_pk(

            pk_columns: {
              id: $id
            }

            _set: {
              status: $status
              error: $error
            }

          ) {

            id
            workflow_id
            org_id
            status
            error

          }

        }
        """

        data = await self._request(
            mutation,
            {
                "id": workflow_run_id,
                "status": status,
                "error": error,
            },
        )

        run = data.get(
            "update_workflow_runs_by_pk"
        )

        if not run:
            raise RuntimeError(
                f"Unable to update workflow run: "
                f"{workflow_run_id}"
            )

        return run

    # ============================================================
    # GET WORKFLOW STEPS
    # ============================================================

    async def get_workflow_steps(
        self,
        workflow_id: str,
    ):
        query = """
        query GetWorkflowSteps(
          $workflow_id: uuid!
        ) {

          workflow_steps(

            where: {
              workflow_id: {
                _eq: $workflow_id
              }
            }

            order_by: {
              step_order: asc
            }

          ) {

            id
            workflow_id
            step_order
            name
            type
            config

          }

        }
        """

        data = await self._request(
            query,
            {
                "workflow_id": workflow_id,
            },
        )

        return data.get(
            "workflow_steps",
            [],
        )

    # ============================================================
    # CREATE APPROVAL
    # ============================================================

    async def create_workflow_approval(
        self,
        workflow_run_id: str,
        workflow_id: str,
        step_id: str,
        org_id: str,
        message: str,
    ):
        mutation = """
        mutation CreateWorkflowApproval(
          $workflow_run_id: uuid!
          $workflow_id: uuid!
          $step_id: uuid!
          $org_id: uuid!
          $message: String!
        ) {

          insert_workflow_approvals_one(

            object: {
              workflow_run_id: $workflow_run_id
              workflow_id: $workflow_id
              step_id: $step_id
              org_id: $org_id
              message: $message
              status: "pending"
            }

          ) {

            id
            workflow_run_id
            workflow_id
            step_id
            org_id
            message
            status
            decided_by

          }

        }
        """

        data = await self._request(
            mutation,
            {
                "workflow_run_id": workflow_run_id,
                "workflow_id": workflow_id,
                "step_id": step_id,
                "org_id": org_id,
                "message": message,
            },
        )

        approval = data.get(
            "insert_workflow_approvals_one"
        )

        if not approval:
            raise RuntimeError(
                "Unable to create workflow approval."
            )

        return approval

    # ============================================================
    # GET APPROVAL
    # ============================================================

    async def get_workflow_approval(
        self,
        approval_id: str,
    ):
        query = """
        query GetWorkflowApproval(
          $id: uuid!
        ) {

          workflow_approvals_by_pk(
            id: $id
          ) {

            id
            workflow_run_id
            workflow_id
            step_id
            org_id
            message
            status
            decided_by

          }

        }
        """

        data = await self._request(
            query,
            {
                "id": approval_id,
            },
        )

        approval = data.get(
            "workflow_approvals_by_pk"
        )

        if not approval:
            raise RuntimeError(
                f"Workflow approval not found: "
                f"{approval_id}"
            )

        return approval

    # ============================================================
    # GET APPROVALS FOR RUN
    # ============================================================

    async def get_workflow_approvals_for_run(
        self,
        workflow_run_id: str,
    ):
        query = """
        query GetWorkflowApprovalsForRun(
          $workflow_run_id: uuid!
        ) {

          workflow_approvals(

            where: {
              workflow_run_id: {
                _eq: $workflow_run_id
              }
            }

          ) {

            id
            workflow_run_id
            workflow_id
            step_id
            org_id
            message
            status
            decided_by

          }

        }
        """

        data = await self._request(
            query,
            {
                "workflow_run_id": workflow_run_id,
            },
        )

        return data.get(
            "workflow_approvals",
            [],
        )

    # ============================================================
    # APPROVE
    # ============================================================

    async def approve_workflow_approval(
        self,
        approval_id: str,
        decided_by: str | None = None,
    ):
        mutation = """
        mutation ApproveWorkflowApproval(
          $id: uuid!
          $decided_by: uuid
        ) {

          update_workflow_approvals_by_pk(

            pk_columns: {
              id: $id
            }

            _set: {
              status: "approved"
              decided_by: $decided_by
            }

          ) {

            id
            workflow_run_id
            workflow_id
            step_id
            org_id
            message
            status
            decided_by

          }

        }
        """

        data = await self._request(
            mutation,
            {
                "id": approval_id,
                "decided_by": decided_by,
            },
        )

        approval = data.get(
            "update_workflow_approvals_by_pk"
        )

        if not approval:
            raise RuntimeError(
                f"Unable to approve workflow approval: "
                f"{approval_id}"
            )

        return approval

    # ============================================================
    # REJECT
    # ============================================================

    async def reject_workflow_approval(
        self,
        approval_id: str,
        decided_by: str | None = None,
    ):
        mutation = """
        mutation RejectWorkflowApproval(
          $id: uuid!
          $decided_by: uuid
        ) {

          update_workflow_approvals_by_pk(

            pk_columns: {
              id: $id
            }

            _set: {
              status: "rejected"
              decided_by: $decided_by
            }

          ) {

            id
            workflow_run_id
            workflow_id
            step_id
            org_id
            message
            status
            decided_by

          }

        }
        """

        data = await self._request(
            mutation,
            {
                "id": approval_id,
                "decided_by": decided_by,
            },
        )

        approval = data.get(
            "update_workflow_approvals_by_pk"
        )

        if not approval:
            raise RuntimeError(
                f"Unable to reject workflow approval: "
                f"{approval_id}"
            )

        return approval
