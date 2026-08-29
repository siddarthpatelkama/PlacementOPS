/**
 * PlacementOps AI Pipeline — Graph Orchestrator
 *
 * Wires the three LangGraph nodes (extract → validate → execute) into
 * a linear state-machine graph and exports a single entry-point function
 * that accepts an initial state payload and returns the fully-resolved
 * final state.
 *
 * @module agents/graph
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { PlacementGraphState } from "./state.js";
import { extractJobDetails } from "./nodes/extract.js";
import { validateResume } from "./nodes/validate.js";
import { draftApplication } from "./nodes/execute.js";

/**
 * Build and compile the PlacementOps agent graph.
 *
 * Topology (linear):
 *   START → extract → validate → execute → END
 *
 * Each node reads from and writes to the shared PlacementGraphState
 * using overwrite reducers — the latest value from each node wins.
 */
const builder = new StateGraph(PlacementGraphState)
  .addNode("extract", extractJobDetails)
  .addNode("validate", validateResume)
  .addNode("execute", draftApplication)
  .addEdge(START, "extract")
  .addEdge("extract", "validate")
  .addEdge("validate", "execute")
  .addEdge("execute", END);

/** Compiled, runnable graph instance. */
const app = builder.compile();

/**
 * Run the full PlacementOps pipeline end-to-end.
 *
 * @param {object} initialState  Must include at minimum:
 *   - rawJd   {string}  Raw job-description / recruiter email text.
 *   - userId  {string}  Supabase UUID of the student.
 * @returns {Promise<object>} The fully-resolved graph state containing:
 *   - extractedData  {object}    Parsed JD (companyName, role, skills[]).
 *   - matchScore     {number}    Resume similarity percentage.
 *   - missingSkills  {string[]}  Skills the student lacks.
 *   - coverLetter    {string}    Tailored application asset.
 */
export const runPlacementPipeline = async (initialState) => {
  console.log("[graph] ── Pipeline started ──");
  console.log(`[graph] User: ${initialState.userId || "unknown"}`);
  console.log(`[graph] JD length: ${initialState.rawJd?.length || 0} chars`);

  const startTime = Date.now();

  const finalState = await app.invoke(initialState);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[graph] ── Pipeline complete in ${elapsed}s ──`);
  console.log(`[graph] Score: ${finalState.matchScore}%`);
  console.log(`[graph] Missing: ${finalState.missingSkills?.length || 0} skills`);
  console.log(`[graph] Cover letter: ${finalState.coverLetter?.length || 0} chars`);

  return finalState;
};
