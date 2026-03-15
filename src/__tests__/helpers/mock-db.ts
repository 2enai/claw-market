interface AgentRow {
  id: string;
  apiKey: string;
  name: string;
  description: string | null;
  capabilities: string[];
  metadata: Record<string, unknown>;
  trustScore: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksClaimed: number;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskConstraints {
  timeoutMinutes?: number;
  maxBudget?: number;
  priority?: "low" | "normal" | "high" | "urgent";
}

interface TaskAttachment {
  name: string;
  url: string;
  type: string;
}

interface TaskRow {
  id: string;
  posterId: string;
  title: string;
  description: string;
  requiredCapabilities: string[];
  acceptanceCriteria: Record<string, unknown>;
  constraints: TaskConstraints;
  attachments: TaskAttachment[];
  status: "posted" | "matched" | "claimed" | "in_progress" | "submitted" | "verified" | "settled" | "rejected" | "escalated" | "cancelled";
  result: Record<string, unknown> | null;
  resolvedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  claimedAt: Date | null;
  completedAt: Date | null;
}

interface ClaimRow {
  id: string;
  taskId: string;
  agentId: string;
  status: "active" | "completed" | "failed" | "abandoned";
  note: string | null;
  result: Record<string, unknown> | null;
  createdAt: Date;
  completedAt: Date | null;
}

interface MockDbState {
  agents: AgentRow[];
  tasks: TaskRow[];
  claims: ClaimRow[];
}

type TableKey = keyof MockDbState;
type Row = AgentRow | TaskRow | ClaimRow;
type UnknownRecord = Record<string, unknown>;

interface EqCondition {
  kind: "eq";
  column: string;
  value: unknown;
}

interface AndCondition {
  kind: "and";
  conditions: Condition[];
}

interface InCondition {
  kind: "in";
  column: string;
  values: unknown[];
}

type Condition = EqCondition | AndCondition | InCondition;

interface ThenableRows<T> {
  then: Promise<T[] | unknown[] | number>[
    "then"
  ];
}

const camelCase = (value: string): string =>
  value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());

const clone = <T>(value: T): T => structuredClone(value);

const getColumnName = (column: unknown): string => {
  if (typeof column === "object" && column !== null) {
    const record = column as UnknownRecord;
    const name = record.name;
    if (typeof name === "string") {
      return name;
    }
  }
  throw new Error("Unsupported column in mock operator");
};

const rowValueByColumn = (row: Row, column: string): unknown => {
  const record = row as unknown as UnknownRecord;
  if (column in record) {
    return record[column];
  }
  const alt = camelCase(column);
  return record[alt];
};

const matchesCondition = (row: Row, condition?: Condition): boolean => {
  if (!condition) {
    return true;
  }

  if (condition.kind === "eq") {
    return rowValueByColumn(row, condition.column) === condition.value;
  }

  if (condition.kind === "in") {
    const value = rowValueByColumn(row, condition.column);
    return condition.values.includes(value);
  }

  return condition.conditions.every((item) => matchesCondition(row, item));
};

const applySelection = (
  rows: Row[],
  selection?: UnknownRecord,
): UnknownRecord[] => {
  if (!selection) {
    return rows.map((row) => clone(row as unknown as UnknownRecord));
  }

  return rows.map((row) => {
    const selected: UnknownRecord = {};
    for (const [key, column] of Object.entries(selection)) {
      selected[key] = rowValueByColumn(row, getColumnName(column));
    }
    return selected;
  });
};

const tableFromRef = (tableRef: unknown): TableKey => {
  if (typeof tableRef === "object" && tableRef !== null) {
    const tableRecord = tableRef as Record<symbol, unknown>;
    for (const symbolKey of Object.getOwnPropertySymbols(tableRef)) {
      if (symbolKey.description === "drizzle:Name") {
        const tableName = tableRecord[symbolKey];
        if (tableName === "agents" || tableName === "tasks" || tableName === "claims") {
          return tableName;
        }
      }
    }
  }
  throw new Error("Unsupported table reference in mock db");
};

const toUuid = (counter: number): string => {
  const suffix = counter.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${suffix}`;
};

const buildAgentRow = (values: UnknownRecord, idCounter: number): AgentRow => ({
  id: typeof values.id === "string" ? values.id : toUuid(idCounter),
  apiKey: typeof values.apiKey === "string" ? values.apiKey : "",
  name: typeof values.name === "string" ? values.name : "",
  description: typeof values.description === "string" ? values.description : null,
  capabilities: Array.isArray(values.capabilities)
    ? (values.capabilities as string[])
    : [],
  metadata:
    typeof values.metadata === "object" && values.metadata !== null
      ? (values.metadata as Record<string, unknown>)
      : {},
  trustScore:
    typeof values.trustScore === "number" ? values.trustScore : 0.5,
  tasksCompleted:
    typeof values.tasksCompleted === "number" ? values.tasksCompleted : 0,
  tasksFailed: typeof values.tasksFailed === "number" ? values.tasksFailed : 0,
  tasksClaimed:
    typeof values.tasksClaimed === "number" ? values.tasksClaimed : 0,
  isActive: typeof values.isActive === "number" ? values.isActive : 1,
  createdAt: values.createdAt instanceof Date ? values.createdAt : new Date(),
  updatedAt: values.updatedAt instanceof Date ? values.updatedAt : new Date(),
});

const buildTaskRow = (values: UnknownRecord, idCounter: number): TaskRow => ({
  id: typeof values.id === "string" ? values.id : toUuid(idCounter),
  posterId: typeof values.posterId === "string" ? values.posterId : "",
  title: typeof values.title === "string" ? values.title : "",
  description: typeof values.description === "string" ? values.description : "",
  requiredCapabilities: Array.isArray(values.requiredCapabilities)
    ? (values.requiredCapabilities as string[])
    : [],
  acceptanceCriteria:
    typeof values.acceptanceCriteria === "object" &&
    values.acceptanceCriteria !== null
      ? (values.acceptanceCriteria as Record<string, unknown>)
      : {},
  constraints:
    typeof values.constraints === "object" && values.constraints !== null
      ? (values.constraints as TaskConstraints)
      : {},
  attachments: Array.isArray(values.attachments)
    ? (values.attachments as TaskAttachment[])
    : [],
  status:
    typeof values.status === "string"
      ? (values.status as TaskRow["status"])
      : "posted",
  result:
    typeof values.result === "object" && values.result !== null
      ? (values.result as Record<string, unknown>)
      : null,
  resolvedById:
    typeof values.resolvedById === "string" ? values.resolvedById : null,
  createdAt: values.createdAt instanceof Date ? values.createdAt : new Date(),
  updatedAt: values.updatedAt instanceof Date ? values.updatedAt : new Date(),
  claimedAt: values.claimedAt instanceof Date ? values.claimedAt : null,
  completedAt: values.completedAt instanceof Date ? values.completedAt : null,
});

const buildClaimRow = (values: UnknownRecord, idCounter: number): ClaimRow => ({
  id: typeof values.id === "string" ? values.id : toUuid(idCounter),
  taskId: typeof values.taskId === "string" ? values.taskId : "",
  agentId: typeof values.agentId === "string" ? values.agentId : "",
  status:
    typeof values.status === "string"
      ? (values.status as ClaimRow["status"])
      : "active",
  note: typeof values.note === "string" ? values.note : null,
  result:
    typeof values.result === "object" && values.result !== null
      ? (values.result as Record<string, unknown>)
      : null,
  createdAt: values.createdAt instanceof Date ? values.createdAt : new Date(),
  completedAt: values.completedAt instanceof Date ? values.completedAt : null,
});

export const createMockDbHarness = () => {
  const state: MockDbState = {
    agents: [],
    tasks: [],
    claims: [],
  };

  let idCounter = 1;

  const db = {
    insert: (tableRef: unknown) => {
      const tableKey = tableFromRef(tableRef);
      return {
        values: (rawValues: UnknownRecord) => {
          let inserted: Row;
          if (tableKey === "agents") {
            inserted = buildAgentRow(rawValues, idCounter++);
            state.agents.push(inserted as AgentRow);
          } else if (tableKey === "tasks") {
            inserted = buildTaskRow(rawValues, idCounter++);
            state.tasks.push(inserted as TaskRow);
          } else {
            inserted = buildClaimRow(rawValues, idCounter++);
            state.claims.push(inserted as ClaimRow);
          }

          return {
            returning: async (): Promise<UnknownRecord[]> => [clone(inserted as unknown as UnknownRecord)],
          };
        },
      };
    },

    select: (selection?: UnknownRecord) => ({
      from: (tableRef: unknown): ThenableRows<UnknownRecord> & {
        where: (condition: Condition) => Promise<UnknownRecord[]>;
        orderBy: (column: unknown) => Promise<UnknownRecord[]>;
      } => {
        const tableKey = tableFromRef(tableRef);
        let rows = state[tableKey].map((row) => clone(row));

        const resolveRows = (): UnknownRecord[] =>
          applySelection(rows as Row[], selection);

        return {
          where: async (condition: Condition): Promise<UnknownRecord[]> => {
            rows = rows.filter((row) =>
              matchesCondition(row as Row, condition),
            );
            return resolveRows();
          },
          orderBy: async (column: unknown): Promise<UnknownRecord[]> => {
            const columnName = getColumnName(column);
            rows.sort((left, right) => {
              const leftValue = rowValueByColumn(left as Row, columnName);
              const rightValue = rowValueByColumn(right as Row, columnName);

              const leftDate = leftValue instanceof Date ? leftValue.getTime() : 0;
              const rightDate =
                rightValue instanceof Date ? rightValue.getTime() : 0;

              return leftDate - rightDate;
            });
            return resolveRows();
          },
          then: (onFulfilled, onRejected) =>
            Promise.resolve(resolveRows()).then(onFulfilled, onRejected),
        };
      },
    }),

    update: (tableRef: unknown) => {
      const tableKey = tableFromRef(tableRef);
      return {
        set: (changes: UnknownRecord) => ({
          where: (condition: Condition): ThenableRows<number> & {
            returning: () => Promise<UnknownRecord[]>;
          } => {
            const rows = state[tableKey];
            const updatedRows: UnknownRecord[] = [];

            for (let index = 0; index < rows.length; index += 1) {
              const row = rows[index];
              if (matchesCondition(row, condition)) {
                const nextRow = {
                  ...row,
                  ...changes,
                } as Row;
                rows[index] = nextRow as never;
                updatedRows.push(clone(nextRow as unknown as UnknownRecord));
              }
            }

            return {
              returning: async () => updatedRows,
              then: (onFulfilled, onRejected) =>
                Promise.resolve(updatedRows.length).then(onFulfilled, onRejected),
            };
          },
        }),
      };
    },
  };

  const operators = {
    eq: (column: unknown, value: unknown): EqCondition => ({
      kind: "eq",
      column: getColumnName(column),
      value,
    }),
    and: (...conditions: Condition[]): AndCondition => ({
      kind: "and",
      conditions,
    }),
    inArray: (column: unknown, values: unknown[]): InCondition => ({
      kind: "in",
      column: getColumnName(column),
      values,
    }),
  };

  const reset = (): void => {
    state.agents = [];
    state.tasks = [];
    state.claims = [];
    idCounter = 1;
  };

  return {
    db,
    operators,
    state,
    reset,
  };
};
