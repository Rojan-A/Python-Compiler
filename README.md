# PyMatrix Compiler

An educational Python compiler built to explore how Python compilers work. This single-page web app simulates a complete Python compiler pipeline with lexer, parser, and executor - all written in JavaScript and styled with that classic green-on-black terminal look that reminds me of the Matrix.

## What It Does

This project lets you write Python code and see exactly how a compiler processes it:

- The **lexer** breaks your code into tokens, handling indentation, keywords, operators, and literals while providing clear error messages when something goes wrong.
- The **parser** transforms those tokens into an abstract syntax tree (AST), supporting all the essentials: operator precedence, control flow statements (if/elif/else, for, while), function declarations, and helpful diagnostics.
- The **interpreter** runs your code with proper variable scoping, function calls, loops, conditionals, and basic type checking.
- **Lists** work just like in Python, with familiar syntax for creating, indexing, and concatenating.
- The **diagnostics panel** shows you compilation times, runtime logs, and error messages in the themed color scheme.
- We've included **helper functions** like `range()` to make writing loop examples easier.

## Saving Your Work

Just click the floppy disk icon next to the run button to download your code as a `.py` file straight from the browser.

## Running the Project

No installation or build process needed - simply open `index.html` in any modern browser (Chrome, Edge, Firefox).

## Project Structure

```
index.html
assets/
  css/theme.css
  js/app.js
  js/compiler.js
  js/errors.js
  js/interpreter.js
  js/lexer.js
  js/parser.js
```


