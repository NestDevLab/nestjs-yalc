import { describe, expect, it, jest } from "@jest/globals";

const { collectOmniKernelQueryPlanEvidence } =
  await import("../omnikernel.diagnostics.js");

const sample = {
  scopeId: "scope-alpha",
  recordKind: "generic",
  recordStatus: "active",
  sourceRecordId: "record-1",
  relationKind: "references",
  relationStatus: "active",
};

describe("OmniKernel query-plan diagnostics", () => {
  it("records sqlite index evidence for the bounded generated read shapes", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          detail:
            "SEARCH omni-record USING INDEX omni_record_scope_kind_status_guid_idx",
        },
      ])
      .mockResolvedValueOnce([
        {
          detail:
            "SEARCH omni-relation USING INDEX omni_relation_scope_source_kind_status_created_guid_idx",
        },
      ]);

    const evidence = await collectOmniKernelQueryPlanEvidence(
      { options: { type: "sqlite" }, query } as never,
      sample,
    );

    expect(evidence).toMatchObject({
      dialect: "sqlite",
      usesRecordGridIndex: true,
      usesRelationSourceIndex: true,
    });
    expect(query.mock.calls[0][0]).toContain("EXPLAIN QUERY PLAN");
    expect(query.mock.calls[1][1]).toEqual([
      sample.scopeId,
      sample.sourceRecordId,
      sample.relationKind,
      sample.relationStatus,
    ]);
  });

  it("records PostgreSQL JSON-plan index evidence", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          "QUERY PLAN": [
            {
              Plan: { "Index Name": "omni_record_scope_kind_status_guid_idx" },
            },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          "QUERY PLAN": [
            {
              Plan: {
                "Index Name":
                  "omni_relation_scope_source_kind_status_created_guid_idx",
              },
            },
          ],
        },
      ]);

    const evidence = await collectOmniKernelQueryPlanEvidence(
      { options: { type: "postgres" }, query } as never,
      sample,
    );

    expect(evidence.dialect).toBe("postgres");
    expect(evidence.usesRecordGridIndex).toBe(true);
    expect(evidence.usesRelationSourceIndex).toBe(true);
    expect(query.mock.calls[0][0]).toContain("EXPLAIN (FORMAT JSON)");
  });

  it("rejects unsupported drivers instead of guessing their query-plan syntax", async () => {
    await expect(
      collectOmniKernelQueryPlanEvidence(
        { options: { type: "mysql" }, query: jest.fn() } as never,
        sample,
      ),
    ).rejects.toThrow("sqlite and postgres only");
  });
});
