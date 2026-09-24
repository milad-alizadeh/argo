## Not domain entities

**Cockpit · Session list · Panels · rooms** are UI surfaces. They render the domain and are
modeled at design time. The **Hub** is an in-memory projection in the main process that joins
domain facts (ADR-0023/0017). Harness adapters, vendor watchers, and XState actors are runtime
mechanisms.
