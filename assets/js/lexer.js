import { CompilerError } from "./errors.js";

// ========================
// Token Type Definitions
// ========================
export const TokenType = {
    IDENTIFIER: "IDENTIFIER",
    KEYWORD: "KEYWORD",
    NUMBER: "NUMBER",
    STRING: "STRING",
    OPERATOR: "OPERATOR",
    DELIMITER: "DELIMITER",
    NEWLINE: "NEWLINE",
    INDENT: "INDENT",
    DEDENT: "DEDENT",
    EOF: "EOF"
};

// ========================
// Lexer Configuration
// ========================
// Python keywords recognized by the lexer
const KEYWORDS = new Set([
    "if",
    "else",
    "elif",
    "while",
    "for",
    "in",
    "def",
    "return",
    "print",
    "and",
    "or",
    "not",
    "True",
    "False",
    "None"
]);

// Multi-character operators (must be checked before single-character operators)
const MULTI_CHAR_OPERATORS = ["==", "!=", "<=", ">=", "//", "**"];

// Single-character operators
const SINGLE_CHAR_OPERATORS = new Set(["+", "-", "*", "/", "%", "=", "<", ">"]);

// Delimiter characters (parentheses, brackets, colons, commas)
const DELIMITERS = new Set(["(", ")", "[", "]", ":", ","]);

// ========================
// Helper Functions
// ========================
// Normalize line endings to Unix style
function sanitize(source) {
    return source.replace(/\r\n?/g, "\n");
}

// Check if character is alphabetic or underscore
function isAlpha(ch) {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

// Check if character is a decimal digit
function isDigit(ch) {
    return ch >= "0" && ch <= "9";
}

// Check if character is alphanumeric (letter, digit, or underscore)
function isAlphaNumeric(ch) {
    return isAlpha(ch) || isDigit(ch);
}

// Create a token object with type, value, and source position information
function createToken(type, value, line, column) {
    return { type, value, line, column };
}

// Tokenize Python source code into a stream of tokens with proper indentation tracking
export function lex(source) {
    const tokens = [];
    const indentStack = [0];
    const text = sanitize(source);
    const lines = text.split("\n");

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const rawLine = lines[lineIndex];
        const logicalLine = lineIndex + 1;
        let cursor = 0;
        let column = 1;
        let indentCount = 0;

        while (cursor < rawLine.length && (rawLine[cursor] === " " || rawLine[cursor] === "\t")) {
            indentCount += rawLine[cursor] === "\t" ? 4 : 1;
            cursor++;
            column++;
        }

        const remaining = rawLine.slice(cursor);
        const isCommentLine = remaining.trimStart().startsWith("#");
        const isBlank = remaining.trim().length === 0;

        if (!isBlank && !isCommentLine) {
            if (indentCount > indentStack[indentStack.length - 1]) {
                indentStack.push(indentCount);
                tokens.push(createToken(TokenType.INDENT, null, logicalLine, 1));
            } else {
                while (indentCount < indentStack[indentStack.length - 1]) {
                    indentStack.pop();
                    tokens.push(createToken(TokenType.DEDENT, null, logicalLine, 1));
                }

                if (indentCount !== indentStack[indentStack.length - 1]) {
                    throw new CompilerError(
                        "Lexical",
                        "inconsistent indentation",
                        logicalLine,
                        column
                    );
                }
            }
        }

        while (cursor < rawLine.length) {
            const ch = rawLine[cursor];

            if (ch === " " || ch === "\t") {
                cursor++;
                column++;
                continue;
            }

            if (ch === "#") {
                break;
            }

            if (isAlpha(ch)) {
                const startColumn = column;
                let lexeme = ch;
                cursor++;
                column++;
                while (cursor < rawLine.length && isAlphaNumeric(rawLine[cursor])) {
                    lexeme += rawLine[cursor];
                    cursor++;
                    column++;
                }
                if (KEYWORDS.has(lexeme)) {
                    tokens.push(createToken(TokenType.KEYWORD, lexeme, logicalLine, startColumn));
                } else {
                    tokens.push(createToken(TokenType.IDENTIFIER, lexeme, logicalLine, startColumn));
                }
                continue;
            }

            if (isDigit(ch) || (ch === "." && isDigit(rawLine[cursor + 1] || ""))) {
                const startColumn = column;
                let lexeme = "";
                let hasDot = false;
                while (cursor < rawLine.length) {
                    const current = rawLine[cursor];
                    if (isDigit(current)) {
                        lexeme += current;
                    } else if (current === "." && !hasDot) {
                        hasDot = true;
                        lexeme += current;
                    } else {
                        break;
                    }
                    cursor++;
                    column++;
                }
                const value = Number(lexeme);
                if (Number.isNaN(value)) {
                    throw new CompilerError("Lexical", `invalid numeric literal '${lexeme}'`, logicalLine, startColumn);
                }
                tokens.push(createToken(TokenType.NUMBER, value, logicalLine, startColumn));
                continue;
            }

            if (ch === "\"" || ch === "'") {
                const quote = ch;
                const startColumn = column;
                cursor++;
                column++;
                let lexeme = "";
                let terminated = false;
                while (cursor < rawLine.length) {
                    const current = rawLine[cursor];
                    if (current === "\\") {
                        const nextChar = rawLine[cursor + 1];
                        if (nextChar === undefined) {
                            throw new CompilerError("Lexical", "unterminated escape sequence", logicalLine, column);
                        }
                        switch (nextChar) {
                            case "n":
                                lexeme += "\n";
                                break;
                            case "t":
                                lexeme += "\t";
                                break;
                            case "r":
                                lexeme += "\r";
                                break;
                            case "\\":
                                lexeme += "\\";
                                break;
                            case "\"":
                                lexeme += "\"";
                                break;
                            case "'":
                                lexeme += "'";
                                break;
                            default:
                                lexeme += nextChar;
                                break;
                        }
                        cursor += 2;
                        column += 2;
                    } else if (current === quote) {
                        terminated = true;
                        cursor++;
                        column++;
                        break;
                    } else {
                        lexeme += current;
                        cursor++;
                        column++;
                    }
                }

                if (!terminated) {
                    throw new CompilerError("Lexical", "unterminated string literal", logicalLine, startColumn);
                }

                tokens.push(createToken(TokenType.STRING, lexeme, logicalLine, startColumn));
                continue;
            }

            const twoChar = rawLine.slice(cursor, cursor + 2);
            if (MULTI_CHAR_OPERATORS.includes(twoChar)) {
                tokens.push(createToken(TokenType.OPERATOR, twoChar, logicalLine, column));
                cursor += 2;
                column += 2;
                continue;
            }

            if (SINGLE_CHAR_OPERATORS.has(ch)) {
                tokens.push(createToken(TokenType.OPERATOR, ch, logicalLine, column));
                cursor++;
                column++;
                continue;
            }

            if (DELIMITERS.has(ch)) {
                tokens.push(createToken(TokenType.DELIMITER, ch, logicalLine, column));
                cursor++;
                column++;
                continue;
            }

            throw new CompilerError("Lexical", `unexpected character '${ch}'`, logicalLine, column);
        }

        tokens.push(createToken(TokenType.NEWLINE, "\n", logicalLine, rawLine.length + 1));
    }

    tokens.push(createToken(TokenType.NEWLINE, "\n", lines.length + 1, 1));

    while (indentStack.length > 1) {
        indentStack.pop();
        tokens.push(createToken(TokenType.DEDENT, null, lines.length + 1, 1));
    }

    tokens.push(createToken(TokenType.EOF, null, lines.length + 1, 1));
    return tokens;
}
