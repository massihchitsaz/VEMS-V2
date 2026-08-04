VEMS DASHBOARD V2 - INSTALLATION

1. Stop the running dev server:
   taskkill /F /IM node.exe

2. Extract this ZIP directly into the VEMS project root.
3. Select "Replace files in the destination".
4. Confirm this file exists after extraction:
   components/dashboard/DashboardPage.tsx
5. Run:
   npm.cmd run build
   npm.cmd run dev
6. Open http://localhost:3000 and press Ctrl+F5.

The dashboard must show the title:
VTC Group Operations Command Center
and the badge:
VEMS Control Tower 2.0
