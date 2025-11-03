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

export class ReturnSignal {
    constructor(value = null) {
        this.value = value;
    }
}
