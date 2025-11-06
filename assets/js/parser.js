import { CompilerError } from "./errors.js";
import { TokenType } from "./lexer.js";

// ========================
// Parse Entry Point
// ========================
// Convert tokens into an Abstract Syntax Tree (AST)
export function parse(tokens) {
    const parser = new Parser(tokens);
    const body = parser.parseProgram();
    return { type: "Program", body };
}

// ========================
// Parser Class
// ========================
// Recursive descent parser that builds an AST from tokens
class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.current = 0;
    }

    // Parse a complete program (sequence of statements at module level)
    parseProgram() {
        const statements = [];
        this.consumeNewlines();
        while (!this.isAtEnd()) {
            if (this.check(TokenType.DEDENT)) {
                break;
            }
            statements.push(this.parseStatement());
            this.consumeNewlines();
        }
        return statements;
    }

    // Parse a single statement (if, while, for, def, return, or simple statement)
    parseStatement() {
        if (this.checkKeyword("if")) {
            return this.parseIfStatement();
        }
        if (this.checkKeyword("while")) {
            return this.parseWhileStatement();
        }
        if (this.checkKeyword("for")) {
            return this.parseForStatement();
        }
        if (this.checkKeyword("def")) {
            return this.parseFunctionDeclaration();
        }
        if (this.checkKeyword("return")) {
            return this.parseReturnStatement();
        }
        return this.parseSimpleStatement();
    }

    // Parse an if statement with optional elif and else clauses
    parseIfStatement() {
        const ifToken = this.consumeKeyword("if", "expected 'if'");
        const test = this.parseExpression();
        this.consumeDelimiter(":", "expected ':' after if condition");
        const consequent = this.parseSuite();
        let alternate = null;
        if (this.checkKeyword("elif")) {
            alternate = this.parseElifChain();
        } else if (this.checkKeyword("else")) {
            this.advance();
            this.consumeDelimiter(":", "expected ':' after else");
            alternate = this.parseSuite();
        }
        return {
            type: "IfStatement",
            test,
            consequent,
            alternate,
            line: ifToken.line
        };
    }

    // Parse elif continuation (recursively handles elif chains)
    parseElifChain() {
        const elifToken = this.consumeKeyword("elif", "expected 'elif'");
        const test = this.parseExpression();
        this.consumeDelimiter(":", "expected ':' after elif condition");
        const consequent = this.parseSuite();
        let alternate = null;
        if (this.checkKeyword("elif")) {
            alternate = this.parseElifChain();
        } else if (this.checkKeyword("else")) {
            this.advance();
            this.consumeDelimiter(":", "expected ':' after else");
            alternate = this.parseSuite();
        }
        return {
            type: "IfStatement",
            test,
            consequent,
            alternate,
            line: elifToken.line
        };
    }

    // Parse a while loop statement
    parseWhileStatement() {
        const whileToken = this.consumeKeyword("while", "expected 'while'");
        const test = this.parseExpression();
        this.consumeDelimiter(":", "expected ':' after while condition");
        const body = this.parseSuite();
        return {
            type: "WhileStatement",
            test,
            body,
            line: whileToken.line
        };
    }

    // Parse a for loop statement
    parseForStatement() {
        const forToken = this.consumeKeyword("for", "expected 'for'");
        const iterator = this.consume(TokenType.IDENTIFIER, "expected loop variable name");
        this.consumeKeyword("in", "expected 'in' in for loop");
        const iterable = this.parseExpression();
        this.consumeDelimiter(":", "expected ':' after for loop expression");
        const body = this.parseSuite();
        return {
            type: "ForStatement",
            iterator: iterator.value,
            iterable,
            body,
            line: forToken.line
        };
    }

    // Parse a function definition
    parseFunctionDeclaration() {
        const defToken = this.consumeKeyword("def", "expected 'def'");
        const nameToken = this.consume(TokenType.IDENTIFIER, "expected function name");
        this.consumeDelimiter("(", "expected '(' after function name");
        const params = [];
        if (!this.checkDelimiter(")")) {
            do {
                const paramToken = this.consume(TokenType.IDENTIFIER, "expected parameter name");
                params.push({ name: paramToken.value, line: paramToken.line });
            } while (this.matchDelimiter(","));
        }
        this.consumeDelimiter(")", "expected ')' after parameters");
        this.consumeDelimiter(":", "expected ':' after function signature");
        const body = this.parseSuite();
        return {
            type: "FunctionDeclaration",
            name: nameToken.value,
            params,
            body,
            line: defToken.line
        };
    }

    // Parse a return statement
    parseReturnStatement() {
        const token = this.consumeKeyword("return", "expected 'return'");
        let value = null;
        if (!this.check(TokenType.NEWLINE) && !this.check(TokenType.DEDENT) && !this.check(TokenType.EOF)) {
            value = this.parseExpression();
        }
        this.expectLineTerminator("expected newline after return");
        return {
            type: "ReturnStatement",
            argument: value,
            line: token.line
        };
    }

    // Parse a simple statement (assignment or expression)
    parseSimpleStatement() {
        const expression = this.parseExpression();
        if (this.matchOperator("=")) {
            if (expression.type !== "Identifier") {
                throw new CompilerError(
                    "Syntax",
                    "assignment target must be an identifier",
                    expression.line,
                    null
                );
            }
            const value = this.parseExpression();
            this.expectLineTerminator("expected newline after assignment");
            return {
                type: "Assignment",
                target: expression.name,
                value,
                line: expression.line
            };
        }
        this.expectLineTerminator("expected newline after expression");
        return {
            type: "ExpressionStatement",
            expression,
            line: expression.line
        };
    }

    // Parse an indented suite of statements (code block)
    parseSuite() {
        if (this.match(TokenType.NEWLINE)) {
            this.consume(TokenType.INDENT, "expected an indented block");
            const statements = [];
            this.consumeNewlines();
            while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
                statements.push(this.parseStatement());
                this.consumeNewlines();
            }
            this.consume(TokenType.DEDENT, "missing matching DEDENT");
            return statements;
        }
        const single = this.parseSimpleStatement();
        return [single];
    }

    // Parse an expression (top level of operator precedence)
    parseExpression() {
        return this.parseOr();
    }

    // Parse logical OR (lowest precedence)
    parseOr() {
        let expr = this.parseAnd();
        while (true) {
            const keyword = this.matchKeyword("or");
            if (!keyword) {
                break;
            }
            const right = this.parseAnd();
            expr = this.buildLogical(expr, keyword, right);
        }
        return expr;
    }

    // Parse logical AND
    parseAnd() {
        let expr = this.parseEquality();
        while (true) {
            const keyword = this.matchKeyword("and");
            if (!keyword) {
                break;
            }
            const right = this.parseEquality();
            expr = this.buildLogical(expr, keyword, right);
        }
        return expr;
    }

    // Parse equality operators (== and !=)
    parseEquality() {
        let expr = this.parseComparison();
        while (true) {
            const operator = this.matchOperatorOneOf(["==", "!="]);
            if (!operator) {
                break;
            }
            const right = this.parseComparison();
            expr = this.buildBinary(expr, operator, right);
        }
        return expr;
    }

    // Parse comparison operators (<, >, <=, >=)
    parseComparison() {
        let expr = this.parseTerm();
        while (true) {
            const operator = this.matchOperatorOneOf(["<", ">", "<=", ">="]);
            if (!operator) {
                break;
            }
            const right = this.parseTerm();
            expr = this.buildBinary(expr, operator, right);
        }
        return expr;
    }

    // Parse addition and subtraction
    parseTerm() {
        let expr = this.parseFactor();
        while (true) {
            const operator = this.matchOperatorOneOf(["+", "-"]);
            if (!operator) {
                break;
            }
            const right = this.parseFactor();
            expr = this.buildBinary(expr, operator, right);
        }
        return expr;
    }

    // Parse multiplication, division, and modulo
    parseFactor() {
        let expr = this.parseUnary();
        while (true) {
            const operator = this.matchOperatorOneOf(["*", "/", "%"]);
            if (!operator) {
                break;
            }
            const right = this.parseUnary();
            expr = this.buildBinary(expr, operator, right);
        }
        return expr;
    }

    // Parse unary operators (not, -, +)
    parseUnary() {
        const keyword = this.matchKeyword("not");
        if (keyword) {
            const argument = this.parseUnary();
            return {
                type: "UnaryExpression",
                operator: "not",
                argument,
                line: keyword.line
            };
        }
        const operator = this.matchOperatorOneOf(["-", "+"]);
        if (operator) {
            const argument = this.parseUnary();
            return {
                type: "UnaryExpression",
                operator: operator.value,
                argument,
                line: operator.line
            };
        }
        return this.parseCall();
    }

    // Parse function calls and subscripts
    parseCall() {
        let expr = this.parsePrimary();
        while (true) {
            if (this.matchDelimiter("(")) {
                const args = [];
                if (!this.checkDelimiter(")")) {
                    do {
                        args.push(this.parseExpression());
                    } while (this.matchDelimiter(","));
                }
                const closing = this.consumeDelimiter(")", "expected ')' to close function call");
                expr = {
                    type: "CallExpression",
                    callee: expr,
                    arguments: args,
                    line: closing.line
                };
            } else if (this.matchDelimiter("[")) {
                const bracketToken = this.previous();
                const indexExpression = this.parseExpression();
                this.consumeDelimiter("]", "expected ']' to close index access");
                expr = {
                    type: "SubscriptExpression",
                    object: expr,
                    index: indexExpression,
                    line: bracketToken.line
                };
            } else {
                break;
            }
        }
        return expr;
    }

    // Parse primary expressions (literals, identifiers, parenthesized expressions, lists)
    parsePrimary() {
        if (this.match(TokenType.NUMBER)) {
            const token = this.previous();
            return {
                type: "NumberLiteral",
                value: token.value,
                line: token.line
            };
        }
        if (this.match(TokenType.STRING)) {
            const token = this.previous();
            return {
                type: "StringLiteral",
                value: token.value,
                line: token.line
            };
        }
        if (this.checkKeyword("print")) {
            const token = this.advance();
            return {
                type: "Identifier",
                name: token.value,
                line: token.line
            };
        }
        if (this.checkKeyword("True") || this.checkKeyword("False")) {
            const token = this.advance();
            return {
                type: "BooleanLiteral",
                value: token.value === "True",
                line: token.line
            };
        }
        if (this.checkKeyword("None")) {
            const token = this.advance();
            return {
                type: "NoneLiteral",
                value: null,
                line: token.line
            };
        }
        if (this.match(TokenType.IDENTIFIER)) {
            const token = this.previous();
            return {
                type: "Identifier",
                name: token.value,
                line: token.line
            };
        }
        if (this.matchDelimiter("(")) {
            const expr = this.parseExpression();
            this.consumeDelimiter(")", "expected ')' after expression");
            return expr;
        }
        if (this.matchDelimiter("[")) {
            const start = this.previous();
            const elements = [];
            if (!this.checkDelimiter("]")) {
                do {
                    elements.push(this.parseExpression());
                } while (this.matchDelimiter(","));
            }
            this.consumeDelimiter("]", "expected ']' after list literal");
            return {
                type: "ListLiteral",
                elements,
                line: start.line
            };
        }
        const token = this.peek();
        throw new CompilerError(
            "Syntax",
            `unexpected token '${token.value ?? token.type}'`,
            token.line,
            token.column
        );
    }

    buildBinary(left, operator, right) {
        return {
            type: "BinaryExpression",
            operator: operator.value,
            left,
            right,
            line: operator.line
        };
    }

    buildLogical(left, keyword, right) {
        return {
            type: "LogicalExpression",
            operator: keyword.value,
            left,
            right,
            line: keyword.line
        };
    }

    expectLineTerminator(message) {
        if (this.match(TokenType.NEWLINE)) {
            this.consumeNewlines();
            return;
        }
        if (this.check(TokenType.EOF) || this.check(TokenType.DEDENT)) {
            return;
        }
        const token = this.peek();
        throw new CompilerError("Syntax", message, token.line, token.column);
    }

    consumeNewlines() {
        while (this.match(TokenType.NEWLINE)) {
            // loop
        }
    }

    consume(type, message) {
        if (this.check(type)) {
            return this.advance();
        }
        const token = this.peek();
        throw new CompilerError("Syntax", message, token.line, token.column);
    }

    consumeDelimiter(value, message) {
        if (this.checkDelimiter(value)) {
            return this.advance();
        }
        const token = this.peek();
        throw new CompilerError("Syntax", message, token.line, token.column);
    }

    consumeKeyword(value, message) {
        const token = this.peek();
        if (this.checkKeyword(value)) {
            return this.advance();
        }
        throw new CompilerError("Syntax", message, token.line, token.column);
    }

    match(type) {
        if (this.check(type)) {
            this.advance();
            return true;
        }
        return false;
    }

    matchDelimiter(value) {
        if (this.checkDelimiter(value)) {
            this.advance();
            return true;
        }
        return false;
    }

    matchKeyword(value) {
        if (this.checkKeyword(value)) {
            return this.advance();
        }
        return null;
    }

    matchOperator(value) {
        if (this.checkOperator(value)) {
            return this.advance();
        }
        return null;
    }

    matchOperatorOneOf(operators) {
        for (const op of operators) {
            if (this.checkOperator(op)) {
                return this.advance();
            }
        }
        return null;
    }

    check(type) {
        if (this.isAtEnd()) {
            return false;
        }
        return this.peek().type === type;
    }

    checkKeyword(value) {
        if (this.isAtEnd()) {
            return false;
        }
        const token = this.peek();
        return token.type === TokenType.KEYWORD && token.value === value;
    }

    checkDelimiter(value) {
        if (this.isAtEnd()) {
            return false;
        }
        const token = this.peek();
        return token.type === TokenType.DELIMITER && token.value === value;
    }

    checkOperator(value) {
        if (this.isAtEnd()) {
            return false;
        }
        const token = this.peek();
        return token.type === TokenType.OPERATOR && token.value === value;
    }

    advance() {
        if (!this.isAtEnd()) {
            this.current++;
        }
        return this.previous();
    }

    previous() {
        return this.tokens[this.current - 1];
    }

    peek() {
        return this.tokens[this.current];
    }

    isAtEnd() {
        return this.peek().type === TokenType.EOF;
    }
}
