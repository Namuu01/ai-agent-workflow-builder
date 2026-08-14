import { nhost } from "../nhost";

export type Workflow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// -----------------------------------------
// HELPER: GraphQL Request Wrapper
// -----------------------------------------
async function gqlRequest<T>(query: string, variables?: Record<string, any>): Promise<T> {
  const response = await nhost.graphql.request({ query, variables });

  if (response.body?.errors?.length) {
    throw new Error(response.body.errors.map((e: any) => e.message).join("\n"));
  }

  return response.body?.data as T;
}

// -----------------------------------------
// GET ALL WORKFLOWS
// -----------------------------------------
export async function getWorkflows(): Promise<Workflow[]> {
  const data = await gqlRequest<{ workflows: Workflow[] }>(`
    query GetWorkflows {
      workflows {
        id
        org_id
        name
        description
        is_active
        created_by
        created_at
        updated_at
      }
    }
  `);
  return data.workflows ?? [];
}

// -----------------------------------------
// GET ONE WORKFLOW
// -----------------------------------------
export async function getWorkflow(id: string): Promise<Workflow | null> {
  const data = await gqlRequest<{ workflows_by_pk: Workflow | null }>(
    `
      query GetWorkflow($id: uuid!) {
        workflows_by_pk(id: $id) {
          id
          org_id
          name
          description
          is_active
          created_by
          created_at
          updated_at
        }
      }
    `,
    { id }
  );
  return data.workflows_by_pk;
}

// -----------------------------------------
// CREATE WORKFLOW
// -----------------------------------------
export async function createWorkflow(
  orgId: string,
  name: string,
  description: string = ""
): Promise<Workflow | null> {
  const data = await gqlRequest<{ insert_workflows_one: Workflow | null }>(
    `
      mutation CreateWorkflow($orgId: uuid!, $name: String!, $description: String) {
        insert_workflows_one(
          object: { org_id: $orgId, name: $name, description: $description }
        ) {
          id
          org_id
          name
          description
          is_active
          created_by
          created_at
          updated_at
        }
      }
    `,
    { orgId, name, description }
  );
  return data.insert_workflows_one;
}

// -----------------------------------------
// UPDATE WORKFLOW
// -----------------------------------------
export async function updateWorkflow(
  id: string,
  name: string,
  description: string,
  isActive: boolean
): Promise<Workflow | null> {
  const data = await gqlRequest<{ update_workflows_by_pk: Workflow | null }>(
    `
      mutation UpdateWorkflow($id: uuid!, $name: String!, $description: String, $isActive: Boolean!) {
        update_workflows_by_pk(
          pk_columns: { id: $id }
          _set: { name: $name, description: $description, is_active: $isActive }
        ) {
          id
          org_id
          name
          description
          is_active
          created_by
          created_at
          updated_at
        }
      }
    `,
    { id, name, description, isActive }
  );
  return data.update_workflows_by_pk;
}

// -----------------------------------------
// DELETE WORKFLOW
// -----------------------------------------
export async function deleteWorkflow(id: string): Promise<{ id: string } | null> {
  const data = await gqlRequest<{ delete_workflows_by_pk: { id: string } | null }>(
    `
      mutation DeleteWorkflow($id: uuid!) {
        delete_workflows_by_pk(id: $id) {
          id
        }
      }
    `,
    { id }
  );
  return data.delete_workflows_by_pk;
}
