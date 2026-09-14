# Smart Attendance Tracker - corrected demo/auth build

## Demo accounts
- Aarav Sharma — aarav.demo@example.com — Demo@1234
- Priya Nair — priya.demo@example.com — Demo@1234
- Rohan Verma — rohan.demo@example.com — Demo@1234
- Dr. Mehta — mehta.demo@example.com — Demo@1234
- Ms. Kapoor — kapoor.demo@example.com — Demo@1234

Aarav starts as CR. The teacher can promote any student to CR from Manage Classes. Only the current CR receives the CR dashboard.

## Important implementation detail
Demo accounts and demo data are stored locally so demo setup never signs into or replaces a real Firebase session. Real email/password accounts still use Firebase Authentication and Firestore.

## Run
npm install
npm run dev
