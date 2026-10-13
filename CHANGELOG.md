# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Agentic development team structure with specialized agents
- OpenCode configuration with hooks, skills, workflows
- Shared context files (architecture decisions, API contracts, coding standards, testing strategy)
- Memory system for agent persistence
- Comprehensive test setup with Chrome API mocking
- GitHub Actions CI pipeline with coverage validation

### Changed
- Updated vitest.config.js with stricter coverage thresholds (90% lines/functions/statements)
- Improved test setup with comprehensive DOM and Chrome API mocks

## [1.0.1] - 2026-01-15

### Added
- Side panel support via Manifest V3 `side_panel` API
- Dedicated tab mode via maximize button
- Vehicle catalog customization (add/edit/remove brands and models)
- Floating fill buttons on page fields
- Keyboard shortcuts (Alt+Shift+S/P/F/L/M)
- Playground sub-tab for CSS selector testing
- Profile system with fixed values
- Legacy profile migration
- Theme support (light/dark) with persistence
- Base URL grouping for multi-subdomain apps

### Changed
- Refactored messaging to use frozen ACTIONS enum
- Improved selector engine with priority-based stable selectors
- Enhanced content script with Select2 and custom select support
- Updated storage schema to group profiles by base URL

### Fixed
- Content script injection race condition
- Floating button positioning on scroll
- Profile loading with fixed values
- SPA navigation detection

## [1.0.0] - 2026-01-10

### Added
- Initial release
- Person, Vehicle, Company data generation
- CPF, CNPJ, VIN validation with check digits
- Field mapping with automatic scan
- Profile save/load/delete/rename
- Fill all / fill individual fields
- Chrome Web Store ready Manifest V3