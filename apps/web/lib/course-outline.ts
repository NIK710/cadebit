export const MAX_OUTLINE_DEPTH = 3;
export const MAX_TOPIC_NAME_LENGTH = 160;

export type CourseOutlineNode = {
  name: string;
  children: CourseOutlineNode[];
};

type SerializableOutlineNode = {
  name: string;
  subtopics: SerializableOutlineNode[];
};

export class CourseOutlineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourseOutlineError";
  }
}

export function parseCourseOutline(value: string): CourseOutlineNode[] {
  const roots: CourseOutlineNode[] = [];
  const stack: Array<{
    indentation: number;
    node: CourseOutlineNode;
  }> = [];

  for (const [index, rawLine] of value.split(/\r?\n/).entries()) {
    if (!rawLine.trim()) continue;
    const lineNumber = index + 1;
    const expanded = rawLine.replace(/^\s+/, (leading) =>
      leading.replaceAll("\t", "  "),
    );
    const indentation = expanded.length - expanded.trimStart().length;
    const name = stripBullet(expanded.trim());
    validateName(name, lineNumber);

    let dedented = false;
    while (
      stack.length > 0 &&
      indentation < stack[stack.length - 1].indentation
    ) {
      stack.pop();
      dedented = true;
    }
    if (
      dedented &&
      stack.length > 0 &&
      indentation !== stack[stack.length - 1].indentation
    ) {
      throw new CourseOutlineError(
        `Line ${lineNumber} uses indentation that does not match an earlier level.`,
      );
    }

    let depth: number;
    if (stack.length === 0) {
      if (indentation !== 0) {
        throw new CourseOutlineError(
          `Line ${lineNumber} must start at the top level.`,
        );
      }
      depth = 1;
    } else {
      const previousIndentation = stack[stack.length - 1].indentation;
      if (indentation > previousIndentation) {
        depth = stack.length + 1;
      } else if (indentation === previousIndentation) {
        stack.pop();
        depth = stack.length + 1;
      } else {
        throw new CourseOutlineError(
          `Line ${lineNumber} uses indentation that does not match an earlier level.`,
        );
      }
    }

    if (depth > MAX_OUTLINE_DEPTH) {
      throw new CourseOutlineError(
        `Line ${lineNumber} is deeper than the supported three outline levels.`,
      );
    }

    const node: CourseOutlineNode = { name, children: [] };
    if (depth === 1) roots.push(node);
    else stack[stack.length - 1].node.children.push(node);
    stack.push({ indentation, node });
  }

  validateCourseOutline(roots);
  return roots;
}

export function serializeCourseOutline(
  nodes: SerializableOutlineNode[],
): string {
  const lines: string[] = [];

  function append(items: SerializableOutlineNode[], depth: number) {
    for (const item of items) {
      const prefix = depth === 1 ? "" : `${"  ".repeat(depth - 1)}- `;
      lines.push(`${prefix}${item.name}`);
      append(item.subtopics, depth + 1);
    }
  }

  append(nodes, 1);
  return lines.join("\n");
}

export function validateCourseOutline(nodes: CourseOutlineNode[]): void {
  function visit(items: CourseOutlineNode[], depth: number) {
    if (depth > MAX_OUTLINE_DEPTH && items.length > 0) {
      throw new CourseOutlineError(
        "Course outlines support at most three levels.",
      );
    }
    for (const item of items) {
      validateName(item.name);
      visit(item.children, depth + 1);
    }
  }

  visit(nodes, 1);
}

function stripBullet(value: string): string {
  return value.replace(/^(?:[-*+] |\d+[.)]\s+)/, "").trim();
}

function validateName(name: string, lineNumber?: number): void {
  const location = lineNumber ? `Line ${lineNumber}` : "Each outline item";
  if (name.length < 2) {
    throw new CourseOutlineError(
      `${location} must contain at least 2 characters.`,
    );
  }
  if (name.length > MAX_TOPIC_NAME_LENGTH) {
    throw new CourseOutlineError(
      `${location} must contain at most ${MAX_TOPIC_NAME_LENGTH} characters.`,
    );
  }
}
