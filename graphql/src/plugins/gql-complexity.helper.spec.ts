import { jest } from '@jest/globals';
import { FieldNode, SelectionNode } from 'graphql';
import { GqlError, GqlErrorMsgs } from './gql.error.js';
import { GqlComplexityHelper } from './gql-complexity.helper.js';

describe('GqlComplexityHelper', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should not allow more than 50 operations', () => {
    const generateSelections = () => {
      const selections: SelectionNode[] = [];
      for (const i of Array(51).keys()) {
        const operation: FieldNode = {
          kind: 'Field',
          name: {
            kind: 'Name',
            value: `operation_${i}`,
          },
        };
        selections.push(operation);
      }

      return selections;
    };

    expect.hasAssertions();
    try {
      GqlComplexityHelper.processDocumentAST({
        kind: 'Document',
        definitions: [
          {
            kind: 'OperationDefinition',
            operation: 'query',
            selectionSet: {
              kind: 'SelectionSet',
              selections: generateSelections(),
            },
          },
        ],
      });
    } catch (err) {
      expect(err).toBeInstanceOf(GqlError);
    }
  });

  it('should not allow circular dependency requested resources', () => {
    expect.hasAssertions();
    try {
      GqlComplexityHelper.hasInvalidNode({
        kind: 'Field',
        name: {
          kind: 'Name',
          value: 'ManageUser_getUser',
        },
        selectionSet: {
          kind: 'SelectionSet',
          selections: [
            {
              kind: 'Field',
              name: {
                kind: 'Name',
                value: 'test_field',
              },
            },
            {
              kind: 'Field',
              name: { kind: 'Name', value: 'nodes' },
              selectionSet: {
                kind: 'SelectionSet',
                selections: [
                  {
                    kind: 'Field',
                    name: {
                      kind: 'Name',
                      value: 'User',
                    },
                  },
                ],
              },
            },
          ],
        },
      });
    } catch (err) {
      expect(err).toBeInstanceOf(GqlError);
      expect(err.message).toBe(GqlErrorMsgs.CIRCULAR_DEPENDENCY_FOUND);
    }
  });

  it('should not process non-FieldNodes', () => {
    const result = GqlComplexityHelper.hasInvalidNode({
      kind: 'FragmentSpread',
      name: {
        kind: 'Name',
        value: 'NON_FIELD_NODE',
      },
    });
    expect(result).toBe(undefined);
  });

  it('should not allow requests with depth 4 or more', () => {
    expect.hasAssertions();
    try {
      GqlComplexityHelper.hasInvalidNode({
        kind: 'Field',
        name: {
          kind: 'Name',
          value: 'DEPTH_1',
        },
        selectionSet: {
          kind: 'SelectionSet',
          selections: [
            {
              kind: 'Field',
              name: {
                kind: 'Name',
                value: 'DEPTH_1',
              },
            },
            {
              kind: 'Field',
              name: { kind: 'Name', value: 'nodes' },
              selectionSet: {
                kind: 'SelectionSet',
                selections: [
                  {
                    kind: 'Field',
                    name: {
                      kind: 'Name',
                      value: 'DEPTH_2',
                    },
                    selectionSet: {
                      kind: 'SelectionSet',
                      selections: [
                        {
                          kind: 'Field',
                          name: {
                            kind: 'Name',
                            value: 'DEPTH_3',
                          },
                          selectionSet: {
                            kind: 'SelectionSet',
                            selections: [
                              {
                                kind: 'Field',
                                name: {
                                  kind: 'Name',
                                  value: 'DEPTH_4',
                                },
                                selectionSet: {
                                  kind: 'SelectionSet',
                                  selections: [
                                    {
                                      kind: 'Field',
                                      name: {
                                        kind: 'Name',
                                        value: 'NOT_ALLOWED_LEVEL',
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      });
    } catch (err) {
      expect(err).toBeInstanceOf(GqlError);
    }
  });

  it('should allow requests with depth 3 or less', () => {
    const response = GqlComplexityHelper.hasInvalidNode({
      kind: 'Field',
      name: {
        kind: 'Name',
        value: 'QUERY_DEPTH (0)',
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: {
              kind: 'Name',
              value: 'DEPTH_1',
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'nodes' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {
                    kind: 'Name',
                    value: 'DEPTH_2',
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: {
                          kind: 'Name',
                          value: 'DEPTH_3',
                        },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: {
                                kind: 'Name',
                                value: 'SHOULD_STILL_BE_ALLOWED',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    });
    // nothing is actually returned, when an error is thrown this test should automatically fail.
    expect(response).toEqual(undefined);
  });

  it('should return when selectionNode has no selectionSet', () => {
    const result = GqlComplexityHelper.hasInvalidNode({
      kind: 'Field',
      name: {
        kind: 'Name',
        value: 'NO_SELECTION_SET',
      },
    });

    expect(result).toBe(undefined);
  });

  it('should throw error when a document has an invalid operation', () => {
    expect.hasAssertions();

    const hasInvalidNodeMockFn = jest
      .spyOn(GqlComplexityHelper, 'hasInvalidNode')
      .mockImplementation(() => {
        throw new GqlError();
      });

    try {
      GqlComplexityHelper.processDocumentAST({
        kind: 'Document',
        definitions: [
          {
            kind: 'OperationDefinition',
            operation: 'query',
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {
                    kind: 'Name',
                    value: 'INVALID_OPERATION',
                  },
                },
              ],
            },
          },
        ],
      });
    } catch (err) {
      expect(hasInvalidNodeMockFn).toHaveBeenCalled();
      expect(err).toBeInstanceOf(GqlError);
    }
  });

  it('should process GraphQL document', () => {
    spyOn(GqlComplexityHelper, 'hasInvalidNode');

    GqlComplexityHelper.processDocumentAST({
      kind: 'Document',
      definitions: [
        {
          kind: 'OperationDefinition',
          operation: 'query',
          selectionSet: {
            kind: 'SelectionSet',
            selections: [
              {
                kind: 'Field',
                name: {
                  kind: 'Name',
                  value: 'VALID_OPERATION',
                },
              },
            ],
          },
        },
      ],
    });
    expect(GqlComplexityHelper.hasInvalidNode).toHaveBeenCalledTimes(1);
  });

  it('should skip ID field', () => {
    spyOn(GqlComplexityHelper, 'findInvalidNode');

    GqlComplexityHelper.processDocumentAST({
      kind: 'Document',
      definitions: [
        {
          kind: 'OperationDefinition',
          operation: 'query',
          selectionSet: {
            kind: 'SelectionSet',
            selections: [
              {
                kind: 'Field',
                name: {
                  kind: 'Name',
                  value: 'ManageUser_getUser',
                },
                selectionSet: {
                  kind: 'SelectionSet',
                  selections: [
                    {
                      kind: 'Field',
                      name: {
                        kind: 'Name',
                        value: 'ID',
                      },
                    },
                    {
                      kind: 'Field',
                      name: {
                        kind: 'Name',
                        value: 'NESTED_FIELD',
                      },
                      selectionSet: {
                        kind: 'SelectionSet',
                        selections: [
                          {
                            kind: 'Field',
                            name: {
                              kind: 'Name',
                              value: 'ID',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    });
    expect(GqlComplexityHelper.findInvalidNode).toHaveBeenCalledTimes(2);
  });

  it('should not process document without selection set', () => {
    expect.hasAssertions();

    const hasInvalidNodeMockFn = jest
      .spyOn(GqlComplexityHelper, 'hasInvalidNode')
      .mockImplementation(() => {
        throw new GqlError();
      });

    try {
      GqlComplexityHelper.processDocumentAST({
        kind: 'Document',
        definitions: [
          {
            kind: 'OperationDefinition',
            operation: 'query',
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: {
                    kind: 'Name',
                    value: 'INVALID_OPERATION',
                  },
                },
              ],
            },
          },
        ],
      });
    } catch (err) {
      expect(hasInvalidNodeMockFn).toHaveBeenCalled();
      expect(err).toBeInstanceOf(GqlError);
    }
  });

  it('should return result in sub-branches', () => {
    const selections: SelectionNode[] = [
      {
        kind: 'Field',
        name: { kind: 'Name', value: 'FIELD_NODE' },
      },
    ];

    jest
      .spyOn(GqlComplexityHelper, 'findInvalidNode')
      .mockImplementation(() => undefined);

    const result = GqlComplexityHelper.processSelectionNodes(selections, {}, 1);
    expect(result).toBe(undefined);
  });

  it('should check the deep of an existing entry', () => {
    const selections: FieldNode = {
      kind: 'Field',
      name: { kind: 'Name', value: 'FIELD_NODE' },
    };
    jest
      .spyOn(GqlComplexityHelper, 'processSelectionNodes')
      .mockImplementation(() => undefined);

    const result = GqlComplexityHelper.findInvalidNode(
      selections,
      { ['FIELD_NODE']: { depth: 1 } },
      1,
    );
    expect(result).toBe(undefined);
  });
});
