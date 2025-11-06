// ========================
// Error Handling
// ========================
// Represents compiler/runtime errors with location information
export class CompilerError extends Error {
    constructor(stage, message, line = null, column = null) {
        const location = line !== null ? ` (line ${line}${column !== null ? ", col " + column : ""})` : "";
        super(`${stage} error${location}: ${message}`);
        this.name = "CompilerError";
        this.stage = stage;
        this.line = line;
        this.column = column;
    }
}

// Control flow signal used to implement function returns
export class ReturnSignal {
    constructor(value = null) {
        this.value = value;
    }
}
