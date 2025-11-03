import { CompilerError, ReturnSignal } from "./errors.js";

class Environment {
    constructor(parent = null) {
        this.parent = parent;
        this.values = new Map();
    }

    has(name) {
        if (this.values.has(name)) {
            return true;
        }
        if (this.parent) {
            return this.parent.has(name);
        }
        return false;
    }

    define(name, value) {
        this.values.set(name, value);
    }

    assign(name, value, line) {
        if (this.values.has(name)) {
            this.values.set(name, value);
            return;
        }
        if (this.parent) {
            this.parent.assign(name, value, line);
            return;
        }
        throw new CompilerError("Runtime", `undefined variable '${name}'`, line, null);
    }

    set(name, value) {
        if (this.values.has(name)) {
            this.values.set(name, value);
        } else {
            this.values.set(name, value);
        }
    }

    get(name, line) {
        if (this.values.has(name)) {
            return this.values.get(name);
        }
        if (this.parent) {
            return this.parent.get(name, line);
        }
        throw new CompilerError("Runtime", `undefined variable '${name}'`, line, null);
    }
}

class UserFunction {
    constructor(declaration, closure) {
        this.declaration = declaration;
        this.closure = closure;
    }

    call(interpreter, args, callNode) {
        const expected = this.declaration.params.length;
        if (args.length !== expected) {
            throw new CompilerError(
                "Runtime",
                `function '${this.declaration.name}' expects ${expected} argument(s) but got ${args.length}`,
                callNode.line,
                null
            );
        }
        const localEnv = new Environment(this.closure);
        this.declaration.params.forEach((param, index) => {
            localEnv.define(param.name, args[index]);
        });
    const signal = interpreter.executeBlock(this.declaration.body, localEnv);
        if (signal instanceof ReturnSignal) {
            return signal.value;
        }
        return null;
    }
}

export class Interpreter {
    constructor() {
        this.reset();
    }

    reset() {
        this.output = [];
        this.logs = [];
        this.globalEnv = new Environment();
        this.installBuiltins();
    }

    installBuiltins() {
        const printFn = {
            arity: null,
            call: (interpreter, args) => {
                const rendered = args.map((value) => interpreter.repr(value)).join(" ");
                interpreter.output.push(rendered);
                return null;
            }
        };
        const rangeFn = {
            arity: null,
            call: (interpreter, args, callNode) => {
                if (args.length < 1 || args.length > 3) {
                    throw new CompilerError(
                        "Runtime",
                        "range expects 1 to 3 arguments",
                        callNode.line,
                        null
                    );
                }
                const numbers = args.map((value) => {
                    interpreter.assertInteger(value, callNode.line, "range arguments must be integers");
                    return value;
                });
                let start;
                let stop;
                let step;
                if (numbers.length === 1) {
                    start = 0;
                    stop = numbers[0];
                    step = 1;
                } else if (numbers.length === 2) {
                    [start, stop] = numbers;
                    step = 1;
                } else {
                    [start, stop, step] = numbers;
                    if (step === 0) {
                        throw new CompilerError("Runtime", "range step cannot be zero", callNode.line, null);
                    }
                }
                const result = [];
                if (step > 0) {
                    for (let value = start; value < stop; value += step) {
                        result.push(value);
                    }
                } else {
                    for (let value = start; value > stop; value += step) {
                        result.push(value);
                    }
                }
                return result;
            }
        };
        this.globalEnv.define("print", printFn);
        this.globalEnv.define("range", rangeFn);
        this.globalEnv.define("True", true);
        this.globalEnv.define("False", false);
        this.globalEnv.define("None", null);
    }

    run(program) {
        this.reset();
        try {
            this.executeBlock(program.body, this.globalEnv);
            this.logs.push({ level: "success", message: "Execution completed successfully." });
            return { output: this.output, logs: this.logs };
        } catch (error) {
            if (error instanceof CompilerError) {
                throw error;
            }
            throw new CompilerError("Runtime", error.message);
        }
    }

    executeBlock(statements, environment) {
        for (const statement of statements) {
            const result = this.execute(statement, environment);
            if (result instanceof ReturnSignal) {
                return result;
            }
        }
        return null;
    }

    execute(node, env) {
        switch (node.type) {
            case "Assignment":
                return this.executeAssignment(node, env);
            case "ExpressionStatement":
                this.evaluate(node.expression, env);
                return null;
            case "IfStatement":
                return this.executeIf(node, env);
            case "WhileStatement":
                return this.executeWhile(node, env);
            case "ForStatement":
                return this.executeFor(node, env);
            case "DoWhileStatement":
                return this.executeDoWhile(node, env);
            case "FunctionDeclaration":
                return this.executeFunctionDeclaration(node, env);
            case "ReturnStatement":
                return this.executeReturn(node, env);
            default:
                throw new CompilerError("Runtime", `unsupported statement type '${node.type}'`, node.line, null);
        }
    }

    executeAssignment(node, env) {
        const value = this.evaluate(node.value, env);
        if (env.has(node.target)) {
            env.assign(node.target, value, node.line);
        } else {
            env.define(node.target, value);
        }
        return null;
    }

    executeIf(node, env) {
        const condition = this.evaluate(node.test, env);
        this.assertBoolean(condition, node.line, "if condition must be boolean");
        if (condition) {
            return this.executeBlock(node.consequent, env);
        }
        if (node.alternate) {
            if (Array.isArray(node.alternate)) {
                return this.executeBlock(node.alternate, env);
            }
            if (typeof node.alternate === "object" && node.alternate.type === "IfStatement") {
                return this.execute(node.alternate, env);
            }
            throw new CompilerError("Runtime", "invalid else branch", node.line, null);
        }
        return null;
    }

    executeWhile(node, env) {
        while (true) {
            const condition = this.evaluate(node.test, env);
            this.assertBoolean(condition, node.line, "while condition must be boolean");
            if (!condition) {
                break;
            }
            const signal = this.executeBlock(node.body, env);
            if (signal instanceof ReturnSignal) {
                return signal;
            }
        }
        return null;
    }

    executeFor(node, env) {
        const iterable = this.evaluate(node.iterable, env);
        const items = this.collectIterableItems(iterable, node.line);
        for (const item of items) {
            if (env.has(node.iterator)) {
                env.assign(node.iterator, item, node.line);
            } else {
                env.define(node.iterator, item);
            }
            const signal = this.executeBlock(node.body, env);
            if (signal instanceof ReturnSignal) {
                return signal;
            }
        }
        return null;
    }

    executeDoWhile(node, env) {
        while (true) {
            const signal = this.executeBlock(node.body, env);
            if (signal instanceof ReturnSignal) {
                return signal;
            }
            const condition = this.evaluate(node.test, env);
            this.assertBoolean(condition, node.line, "do-while condition must be boolean");
            if (!condition) {
                break;
            }
        }
        return null;
    }

    executeFunctionDeclaration(node, env) {
        const fn = new UserFunction(node, env);
        env.define(node.name, fn);
        return null;
    }

    executeReturn(node, env) {
        const value = node.argument ? this.evaluate(node.argument, env) : null;
        return new ReturnSignal(value);
    }

    evaluate(node, env) {
        switch (node.type) {
            case "NumberLiteral":
                return node.value;
            case "StringLiteral":
                return node.value;
            case "BooleanLiteral":
                return node.value;
            case "NoneLiteral":
                return null;
            case "Identifier":
                return env.get(node.name, node.line);
            case "ListLiteral":
                return node.elements.map((element) => this.evaluate(element, env));
            case "BinaryExpression":
                return this.evaluateBinary(node, env);
            case "LogicalExpression":
                return this.evaluateLogical(node, env);
            case "UnaryExpression":
                return this.evaluateUnary(node, env);
            case "CallExpression":
                return this.evaluateCall(node, env);
            case "SubscriptExpression":
                return this.evaluateSubscript(node, env);
            default:
                throw new CompilerError("Runtime", `unsupported expression type '${node.type}'`, node.line, null);
        }
    }

    evaluateBinary(node, env) {
        const left = this.evaluate(node.left, env);
        const right = this.evaluate(node.right, env);
        switch (node.operator) {
            case "+":
                if (typeof left === "number" && typeof right === "number") {
                    return left + right;
                }
                if (typeof left === "string" && typeof right === "string") {
                    return left + right;
                }
                if (Array.isArray(left) && Array.isArray(right)) {
                    return [...left, ...right];
                }
                throw new CompilerError("Runtime", "'+' expects both numbers, both strings, or both lists", node.line, null);
            case "-":
                this.assertNumber(left, node.line, "left operand of '-' must be a number");
                this.assertNumber(right, node.line, "right operand of '-' must be a number");
                return left - right;
            case "*":
                this.assertNumber(left, node.line, "left operand of '*' must be a number");
                this.assertNumber(right, node.line, "right operand of '*' must be a number");
                return left * right;
            case "/":
                this.assertNumber(left, node.line, "left operand of '/' must be a number");
                this.assertNumber(right, node.line, "right operand of '/' must be a number");
                if (right === 0) {
                    throw new CompilerError("Runtime", "division by zero", node.line, null);
                }
                return left / right;
            case "%":
                this.assertNumber(left, node.line, "left operand of '%' must be a number");
                this.assertNumber(right, node.line, "right operand of '%' must be a number");
                if (right === 0) {
                    throw new CompilerError("Runtime", "modulo by zero", node.line, null);
                }
                return left % right;
            case "==":
                return left === right;
            case "!=":
                return left !== right;
            case "<":
            case "<=":
            case ">":
            case ">=":
                this.assertNumber(left, node.line, `left operand of '${node.operator}' must be a number`);
                this.assertNumber(right, node.line, `right operand of '${node.operator}' must be a number`);
                switch (node.operator) {
                    case "<":
                        return left < right;
                    case "<=":
                        return left <= right;
                    case ">":
                        return left > right;
                    case ">=":
                        return left >= right;
                    default:
                        return false;
                }
            default:
                throw new CompilerError("Runtime", `unsupported operator '${node.operator}'`, node.line, null);
        }
    }

    evaluateSubscript(node, env) {
        const target = this.evaluate(node.object, env);
        const indexValue = this.evaluate(node.index, env);
        this.assertInteger(indexValue, node.line, "index must be an integer");
        const index = indexValue;
        if (Array.isArray(target)) {
            this.assertBounds(index, target.length, node.line, "list index out of range");
            return target[index];
        }
        if (typeof target === "string") {
            this.assertBounds(index, target.length, node.line, "string index out of range");
            return target.charAt(index);
        }
        throw new CompilerError("Runtime", "object is not subscriptable", node.line, null);
    }

    evaluateLogical(node, env) {
        if (node.operator === "and") {
            const left = this.evaluate(node.left, env);
            this.assertBoolean(left, node.line, "left operand of 'and' must be boolean");
            if (!left) {
                return false;
            }
            const right = this.evaluate(node.right, env);
            this.assertBoolean(right, node.line, "right operand of 'and' must be boolean");
            return left && right;
        }
        if (node.operator === "or") {
            const left = this.evaluate(node.left, env);
            this.assertBoolean(left, node.line, "left operand of 'or' must be boolean");
            if (left) {
                return true;
            }
            const right = this.evaluate(node.right, env);
            this.assertBoolean(right, node.line, "right operand of 'or' must be boolean");
            return left || right;
        }
        throw new CompilerError("Runtime", `unsupported logical operator '${node.operator}'`, node.line, null);
    }

    evaluateUnary(node, env) {
        const argument = this.evaluate(node.argument, env);
        switch (node.operator) {
            case "not":
                this.assertBoolean(argument, node.line, "'not' operand must be boolean");
                return !argument;
            case "-":
                this.assertNumber(argument, node.line, "unary '-' operand must be a number");
                return -argument;
            case "+":
                this.assertNumber(argument, node.line, "unary '+' operand must be a number");
                return +argument;
            default:
                throw new CompilerError("Runtime", `unsupported unary operator '${node.operator}'`, node.line, null);
        }
    }

    evaluateCall(node, env) {
        const callee = this.evaluate(node.callee, env);
        const args = node.arguments.map((arg) => this.evaluate(arg, env));
        if (callee instanceof UserFunction) {
            return callee.call(this, args, node);
        }
        if (callee && typeof callee.call === "function") {
            return callee.call(this, args, node);
        }
        throw new CompilerError("Runtime", "attempted to call a non-callable value", node.line, null);
    }

    collectIterableItems(value, line) {
        if (Array.isArray(value)) {
            return value;
        }
        if (typeof value === "string") {
            return value.split("");
        }
        throw new CompilerError("Runtime", "for loop iterable must be a list or string", line, null);
    }

    assertNumber(value, line, message) {
        if (typeof value !== "number" || Number.isNaN(value)) {
            throw new CompilerError("Runtime", message, line, null);
        }
    }

    assertBoolean(value, line, message) {
        if (typeof value !== "boolean") {
            throw new CompilerError("Runtime", message, line, null);
        }
    }

    assertInteger(value, line, message) {
        if (typeof value !== "number" || !Number.isInteger(value)) {
            throw new CompilerError("Runtime", message, line, null);
        }
    }

    assertBounds(index, length, line, message) {
        if (index < 0 || index >= length) {
            throw new CompilerError("Runtime", message, line, null);
        }
    }

    repr(value) {
        if (value === null) {
            return "None";
        }
        if (typeof value === "boolean") {
            return value ? "True" : "False";
        }
        if (typeof value === "string") {
            return value;
        }
        if (Array.isArray(value)) {
            const rendered = value.map((item) => this.repr(item)).join(", ");
            return `[${rendered}]`;
        }
        return String(value);
    }
}
