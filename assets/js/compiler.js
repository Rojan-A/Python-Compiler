import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import { Interpreter } from "./interpreter.js";

export function compileAndRun(source) {
    const tokens = lex(source);
    const ast = parse(tokens);
    const interpreter = new Interpreter();
    const execution = interpreter.run(ast);
    return {
        output: execution.output,
        logs: execution.logs
    };
}
