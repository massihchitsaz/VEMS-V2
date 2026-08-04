VEMS Sprint 7 - Management Intelligence OS

Extract into the VEMS project root and replace duplicate files.

Added / upgraded routes:
- /approvals
- /reports
- /reports/treasury
- /reports/commercial
- /reports/logistics
- /ai

Features:
- Operational approval workflow with approve/reject decisions
- Decision notes and localStorage persistence
- Executive reporting and management risks
- Treasury, Commercial and Logistics report pages
- Multi-mode AI Operations Assistant
- Sidebar navigation badges

Run:
1. taskkill /F /IM node.exe
2. npm.cmd run build
3. npm.cmd run dev
