# Evaluation Tests (evals/)

This directory is reserved for future skill evaluation tests.

## Purpose

Evaluation tests (evals) validate that AI assistants correctly understand and apply the rules defined in this skill when generating code or providing guidance.

## Structure

When implemented, evals will follow this structure:

```
evals/
├── naming/
│   ├── test-object-names.md
│   ├── test-field-keys.md
│   └── test-option-values.md
├── relationships/
│   ├── test-lookup-vs-master-detail.md
│   └── test-junction-patterns.md
├── validation/
│   ├── test-script-inversion.md
│   └── test-state-machine.md
└── ...
```

## Format

Each eval file will contain:
1. **Scenario** — Description of the task
2. **Expected Output** — Correct implementation
3. **Common Mistakes** — Incorrect patterns to avoid
4. **Validation Criteria** — How to score the output

## Status

⚠️ **Not yet implemented** — This is a placeholder for future development.

## Contributing

When adding evals:
1. Each eval should test a single, specific rule or pattern
2. Include both positive (correct) and negative (incorrect) examples
3. Reference the corresponding rule file in `rules/`
4. Use realistic scenarios from actual ObjectStack projects
