# Project Guidance

This file provides context and guidance for working with this project.

## Instructions

Please periodically update this file as the project evolves to include:
- Project overview and goals
- Setup and installation instructions
- Development workflow
- Coding standards and conventions
- Testing approach
- Any other relevant information for working with this codebase

## Project Rules

### Logging

**NEVER remove logging statements.** This project uses verbose logging at every possible spot for debugging and monitoring purposes.

- All console.log statements must be preserved
- Add more logging when implementing new features
- Use descriptive log prefixes (e.g., `[ServiceName]`, `[MethodName]`)
- Log configuration, state changes, errors, and important execution steps

The linter is configured to allow console.log statements (biome.json has `"noConsole": "off"`).
