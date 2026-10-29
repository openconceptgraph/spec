/** One finding. Errors make a bundle non-conformant; warnings are worth a person's look. */
export interface Issue {
  /** The rule's name, as listed in docs/validation.md. */
  rule: string;
  severity: "error" | "warning";
  message: string;
  /** The bundle file the finding is in, when there is one. */
  file?: string;
  /** The object the finding is about, when there is one. */
  id?: string;
}

export interface Result {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
}

export class Report {
  readonly issues: Issue[] = [];

  error(rule: string, message: string, at: { file?: string; id?: string } = {}): void {
    this.issues.push({ rule, severity: "error", message, ...at });
  }

  warn(rule: string, message: string, at: { file?: string; id?: string } = {}): void {
    this.issues.push({ rule, severity: "warning", message, ...at });
  }

  get hasErrors(): boolean {
    return this.issues.some((i) => i.severity === "error");
  }

  result(): Result {
    const errors = this.issues.filter((i) => i.severity === "error");
    return { ok: errors.length === 0, errors, warnings: this.issues.filter((i) => i.severity === "warning") };
  }
}
