import { compileAndRun } from "./compiler.js";
import { CompilerError } from "./errors.js";

const editor = document.getElementById("source-editor");
const runBtn = document.getElementById("run-btn");
const resetBtn = document.getElementById("reset-btn");
const saveBtn = document.getElementById("save-btn");
const exampleSelect = document.getElementById("example-select");
const outputConsole = document.getElementById("output-console");
const statusIndicator = document.getElementById("status-indicator");

const NO_OUTPUT_PLACEHOLDER = "[no output]";
const DEFAULT_DOWNLOAD_NAME = "pymatrix_program";

const EXAMPLES = [
    {
        id: "print",
        label: "PRINT",
        code: "greetings = \"Hello PyMatrix\"\ndeveloper = \"Group 6\"\ncourse = \"Principles of Programming Languages\"\nprogram = \"BS in Computer Science\"\nproject = \"Interpreter or Compiler Simulation\"\nprint(\"=== PyMatrix Compiler Demo ===\")\nprint(greetings)\nprint(\"Developed by:\", developer)\nprint(\"Course:\", course)\nprint(\"Degree Program:\", program)\nprint(\"Project:\", project)\nprint(\"==============================\")\n"
    },
    {
        id: "variables-arithmetic",
        label: "Variables & Arithmetic",
        code: "a = 10\nb = 3\nc = 5\nd = 2\nsum_ab = a + b\nmix = sum_ab * c - d\naverage = (a + b + c + d) / 4\nprint(\"values:\", a, b, c, d)\nprint(\"sum_ab =\", sum_ab)\nprint(\"mix =\", mix)\nprint(\"average =\", average)\n"
    },
    {
        id: "if-else",
        label: "If-Elif-Else",
        code: "score = 78\nbonus = 5\nfinal = score + bonus\nif final >= 90:\n    print(\"grade: A\")\nelif final >= 80:\n    print(\"grade: B\")\nelse:\n    print(\"grade: C or below\")\nprint(\"initial score =\", score)\nprint(\"final score =\", final)\n"
    },
    {
        id: "while-loop",
        label: "While Loop",
        code: "count = 1\nlimit = 5\ntotal = 0\nsquares = []\nwhile count <= limit:\n    squares = squares + [count * count]\n    total = total + count\n    print(\"count =\", count, \"square =\", count * count)\n    count = count + 1\nprint(\"sum =\", total)\nprint(\"squares =\", squares)\n"
    },
    {
        id: "for-loop",
        label: "For Loop",
        code: "values = [3, 6, 9, 12, 15]\ntotal = 0\ncount = 0\nfor value in values:\n    total = total + value\n    count = count + 1\n    print(\"adding\", value, \"-> total =\", total)\nprint(\"count =\", count)\nprint(\"average =\", total / count)\n"
    },
    {
        id: "nested-loops",
        label: "Nested Loops",
        code: "outer = 1\nwhile outer <= 2:\n    inner = 1\n    print(\"row\", outer, \"start\")\n    while inner <= 3:\n        print(\"cell\", outer, inner)\n        inner = inner + 1\n    print(\"row\", outer, \"done\")\n    outer = outer + 1\nprint(\"grid complete\")\n"
    },
    {
        id: "lists",
        label: "Lists",
        code: "numbers = [3, 5, 8, 13]\nnumbers = numbers + [21]\nnames = [\"Neo\", \"Trinity\", \"Morpheus\", \"Cypher\"]\nindex = 0\nwhile index < 4:\n    print(\"pair:\", names[index], numbers[index])\n    index = index + 1\nprint(\"first =\", numbers[0])\nprint(\"last =\", numbers[3])\nprint(\"extended =\", numbers)\n"
    },
    {
        id: "functions",
        label: "Functions",
        code: "def greet(name):\n    print(\"Hello\", name)\n    print(\"Welcome to PyMatrix\")\n    print(\"Enjoy exploring loops\")\nprint(\"Preparing greetings\")\ngreet(\"Neo\")\ngreet(\"Trinity\")\ngreet(\"Morpheus\")\nprint(\"All greetings sent\")\n"
    },
    {
        id: "function-return",
        label: "Function with Return",
        code: "def square(x):\n    return x * x\n\ndef describe(value):\n    squared = square(value)\n    print(\"value =\", value)\n    print(\"square =\", squared)\n    return squared\nnumbers = [2, 4, 6]\nresults = []\nfor num in numbers:\n    results = results + [describe(num)]\nprint(\"results =\", results)\n"
    },
    {
        id: "complete-program",
        label: "Complete Program",
        code: "def fibonacci(n):\n    if n <= 1:\n        return n\n    else:\n        return fibonacci(n - 1) + fibonacci(n - 2)\n\ndef show_fib(limit):\n    index = 0\n    while index < limit:\n        value = fibonacci(index)\n        if (value % 2) == 0:\n            print(\"even\", index, value)\n        else:\n            print(\"odd\", index, value)\n        index = index + 1\n\nshow_fib(6)\n"
    }
];

initialize();

function initialize() {
    populateExampleMenu();
    loadInitialExample();
    registerEvents();
    setStatus("ready", "ready");
}

function populateExampleMenu() {
    EXAMPLES.forEach((example) => {
        const option = document.createElement("option");
        option.value = example.id;
        option.textContent = example.label;
        exampleSelect.append(option);
    });
}

function loadInitialExample() {
    const firstExample = EXAMPLES[0];
    exampleSelect.value = firstExample.id;
    editor.value = firstExample.code;
    clearConsole();
}

function registerEvents() {
    runBtn.addEventListener("click", () => {
        handleRun();
    });

    resetBtn.addEventListener("click", () => {
        exampleSelect.value = "custom";
        editor.value = "";
        clearConsole();
        setStatus("ready", "ready");
    });

    saveBtn.addEventListener("click", () => {
        handleSave();
    });

    exampleSelect.addEventListener("change", () => {
        if (exampleSelect.value === "custom") {
            return;
        }
        const selection = EXAMPLES.find((example) => example.id === exampleSelect.value);
        if (selection) {
            editor.value = selection.code;
            clearConsole();
            setStatus("ready", selection.label.toLowerCase());
        }
    });
}

function handleRun() {
    const source = editor.value;
    clearConsole();
    if (!source.trim()) {
        outputConsole.textContent = "Provide some Python code to compile.";
        setStatus("idle", "waiting");
        return;
    }
    setStatus("running", "compiling...");
    try {
        const result = compileAndRun(source);
        const finalMessage = getFinalMessage(result.logs);
        renderConsole(result.output, finalMessage, false);
        setStatus("success", "success");
    } catch (error) {
        handleError(error);
    }
}

function handleSave() {
    const source = editor.value;
    const fileName = buildDownloadFileName();
    triggerDownload(source, fileName);
    setStatus("success", "downloaded");
}

function buildDownloadFileName() {
    const activeId = exampleSelect.value;
    if (activeId && activeId !== "custom") {
        return `${activeId}.py`;
    }
    const timestamp = formatTimestamp(new Date());
    return `${DEFAULT_DOWNLOAD_NAME}_${timestamp}.py`;
}

function formatTimestamp(date) {
    return [
        date.getFullYear(),
        padNumber(date.getMonth() + 1),
        padNumber(date.getDate()),
        padNumber(date.getHours()),
        padNumber(date.getMinutes()),
        padNumber(date.getSeconds())
    ].join("");
}

function padNumber(value) {
    return String(value).padStart(2, "0");
}

function triggerDownload(content, fileName) {
    const blob = new Blob([content], { type: "text/x-python;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function renderConsole(outputLines, message, isError = false) {
    const lines = outputLines && outputLines.length > 0 ? outputLines : [NO_OUTPUT_PLACEHOLDER];
    const safeLines = lines.map((line) => escapeHtml(line));
    const parts = [];
    parts.push(safeLines.join("<br>"));
    parts.push("<br><br>");
    parts.push(`<em class="console-status${isError ? " error" : ""}">${escapeHtml(message)}</em>`);
    outputConsole.innerHTML = parts.join("");
}

function handleError(error) {
    if (error instanceof CompilerError) {
        renderConsole(
            [error.message],
            "Compilation failed.",
            true
        );
        setStatus("error", "error");
    } else {
        console.error(error);
        renderConsole(
            ["Unexpected failure. Check console for details."],
            "Compilation failed.",
            true
        );
        setStatus("error", "fatal error");
    }
}

function clearConsole() {
    outputConsole.innerHTML = "";
}

function setStatus(state, text) {
    statusIndicator.dataset.state = state;
    statusIndicator.textContent = text;
}

function getFinalMessage(logs) {
    if (!Array.isArray(logs) || logs.length === 0) {
        return "Execution finished.";
    }
    const lastEntry = logs[logs.length - 1];
    if (!lastEntry || typeof lastEntry.message !== "string") {
        return "Execution finished.";
    }
    return lastEntry.message;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
