# Evaluation Tests (evals/)

This directory is reserved for future skill evaluation tests.

## Purpose

Evaluation tests (evals) validate that AI assistants correctly understand and apply the kernel rules when developing plugins.

## Structure

When implemented, evals will follow this structure:

```
evals/
├── plugin-lifecycle/
│   ├── test-init-phase.md
│   ├── test-start-phase.md
│   └── test-destroy-phase.md
├── service-registry/
│   ├── test-registration.md
│   ├── test-consumption.md
│   └── test-factories.md
├── hooks-events/
│   ├── test-data-hooks.md
│   └── test-custom-events.md
└── ...
```

## Status

⚠️ **Not yet implemented** — This is a placeholder for future development.

## Contributing

When adding evals:
1. Each eval should test a single, specific rule or pattern
2. Include both positive (correct) and negative (incorrect) examples
3. Reference the corresponding rule file in `rules/`
4. Use realistic scenarios from actual ObjectStack plugins
