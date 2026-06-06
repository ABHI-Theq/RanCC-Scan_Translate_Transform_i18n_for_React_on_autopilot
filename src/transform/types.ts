export interface TransformOptions {
  dryRun: boolean;
  backup: boolean;
}

export interface TransformResult {
  /** absolute or cwd-relative file path */
  file: string;
  /** whether any changes were made to this file */
  changed: boolean;
  /** i18n keys that were substituted in this file */
  replacedKeys: string[];
  /** original source code before transformation */
  original: string;
  /** transformed (and formatted) source code */
  output: string;
  /** non-fatal warnings encountered during processing */
  warnings: string[];
}

export interface ProjectTransformSummary {
  modifiedFiles: number;
  totalStrings: number;
  warnings: string[];
}
