/**
 * YAML parse errors.
 */
export class ParseError extends SyntaxError {
  public index: number;

  public lineNumber: number;

  public column: number;

  /**
   * Initialize this ParseError instance.
   * @param message The error message.
   * @param offset The offset number of this error.
   * @param line The line number of this error.
   * @param column The column number of this error.
   */
  public constructor(
    message: string,
    offset: number,
    line: number,
    column: number,
  ) {
    super(message);
    this.index = offset;
    this.lineNumber = line;
    this.column = column;
  }
}
