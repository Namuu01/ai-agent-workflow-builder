import { nhost } from "../nhost";

export type WorkflowStep = {
  id: string;
  workflow_id: string;
  step_order: number;
  name: string;
  type: string;
  config: Record<string, any>;
};

type WorkflowStepsResponse = {
  workflow_steps: WorkflowStep[];
};

type WorkflowStepResponse = {
  workflow_steps_by_pk: WorkflowStep | null;
};

type CreateWorkflowStepResponse = {
  insert_workflow_steps_one: WorkflowStep | null;
};

type UpdateWorkflowStepResponse = {
  update_workflow_steps_by_pk: WorkflowStep | null;
};

type DeleteWorkflowStepResponse = {
  delete_workflow_steps_by_pk: { id: string } | null;
};

// -----------------------------------------
// GET ALL STEPS FOR A WORKFLOW
// -----------------------------------------

export async function getWorkflowSteps(
  workflowId: string
): Promise<WorkflowStep[]> {
  const response = await nhost.graphql.request<WorkflowStepsResponse>({
    query: `
      query GetWorkflowSteps($workflowId: uuid!) {
        workflow_steps(
          where: {
            workflow_id: {
              _eq: $workflowId
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
    `,
    variables: {
      workflowId,
    },
  });

  if (response.body?.errors) {
    throw new Error(
      response.body.errors
        .map((error: any) => error.message)
        .join("\n")
    );
  }

  return response.body?.data?.workflow_steps ?? [];
}

// -----------------------------------------
// GET ONE STEP
// -----------------------------------------

export async function getWorkflowStep(
  id: string
): Promise<WorkflowStep | null> {
  const response =
    await nhost.graphql.request<WorkflowStepResponse>({
      query: `
        query GetWorkflowStep($id: uuid!) {
          workflow_steps_by_pk(id: $id) {
            id
            workflow_id
            step_order
            name
            type
            config
          }
        }
      `,
      variables: {
        id,
      },
    });

  if (response.body?.errors) {
    throw new Error(
      response.body.errors
        .map((error: any) => error.message)
        .join("\n")
    );
  }

  return response.body?.data?.workflow_steps_by_pk ?? null;
}

// -----------------------------------------
// CREATE STEP
// -----------------------------------------

export async function createWorkflowStep(
  workflowId: string,
  stepOrder: number,
  name: string,
  type: string,
  config: Record<string, any> = {}
): Promise<WorkflowStep | null> {
  const response =
    await nhost.graphql.request<CreateWorkflowStepResponse>({
      query: `
        mutation CreateWorkflowStep(
          $workflowId: uuid!
          $stepOrder: Int!
          $name: String!
          $type: String!
          $config: jsonb!
        ) {
          insert_workflow_steps_one(
            object: {
              workflow_id: $workflowId
              step_order: $stepOrder
              name: $name
              type: $type
              config: $config
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
      `,
      variables: {
        workflowId,
        stepOrder,
        name,
        type,
        config,
      },
    });

  if (response.body?.errors) {
    throw new Error(
      response.body.errors
        .map((error: any) => error.message)
        .join("\n")
    );
  }

  return (
    response.body?.data?.insert_workflow_steps_one ??
    null
  );
}

// -----------------------------------------
// UPDATE STEP
// -----------------------------------------

export async function updateWorkflowStep(
  id: string,
  stepOrder: number,
  name: string,
  type: string,
  config: Record<string, any>
): Promise<WorkflowStep | null> {
  const response =
    await nhost.graphql.request<UpdateWorkflowStepResponse>({
      query: `
        mutation UpdateWorkflowStep(
          $id: uuid!
          $stepOrder: Int!
          $name: String!
          $type: String!
          $config: jsonb!
        ) {
          update_workflow_steps_by_pk(
            pk_columns: {
              id: $id
            }
            _set: {
              step_order: $stepOrder
              name: $name
              type: $type
              config: $config
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
      `,
      variables: {
        id,
        stepOrder,
        name,
        type,
        config,
      },
    });

  if (response.body?.errors) {
    throw new Error(
      response.body.errors
        .map((error: any) => error.message)
        .join("\n")
    );
  }

  return (
    response.body?.data?.update_workflow_steps_by_pk ??
    null
  );
}

// -----------------------------------------
// DELETE STEP
// -----------------------------------------

export async function deleteWorkflowStep(
  id: string
): Promise<{ id: string } | null> {
  const response =
    await nhost.graphql.request<DeleteWorkflowStepResponse>({
      query: `
        mutation DeleteWorkflowStep($id: uuid!) {
          delete_workflow_steps_by_pk(id: $id) {
            id
          }
        }
      `,
      variables: {
        id,
      },
    });

  if (response.body?.errors) {
    throw new Error(
      response.body.errors
        .map((error: any) => error.message)
        .join("\n")
    );
  }

  return (
    response.body?.data?.delete_workflow_steps_by_pk ??
    null
  );
}