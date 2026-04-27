# Security Specification - PostByteCL

## Data Invariants
1. A **Thread** must belong to an existing **Board**.
2. A **Post** must belong to an existing **Thread**.
3. Only **Admins** can create/edit **Boards**.
4. Only **Admins** can delete **Posts** or **Threads**.
5. Guests can only **Create** posts/threads; they cannot **Update** or **Delete** them.
6. **Bans** and **Reports** are only visible to **Staff**.

## The Dirty Dozen (Attack Vectors)
1. **Malicious Delete**: A guest tries to delete another person's post. (Denied)
2. **Shadow Update**: A guest tries to change the content of a post after creation. (Denied)
3. **Board Injection**: A guest tries to create a new board `/hacker/`. (Denied)
4. **Staff Impersonation**: A guest tries to create a user document in `/users/` to gain admin rights. (Denied)
5. **ID Poisoning**: Creating a thread with a 1MB string as ID. (Denied by size checks)
6. **Report Leak**: A guest tries to read the `/reports/` collection to see who is getting reported. (Denied)
7. **Ban Evasion Detection**: A guest tries to read the `/bans/` collection. (Denied)
8. **Relational Break**: Posting to a thread that doesn't exist. (Denied by `exists()`)
9. **Field Injection**: Adding `isAdmin: true` to a post document. (Denied by `isValidPost`)
10. **Timestamp Spoofing**: Setting `createdAt` to 10 years in the future. (Denied by `request.time` check)
11. **Locked Thread Reply**: Posting to a thread where `isLocked == true`. (Denied)
12. **Pinned Status Theft**: A guest tries to pin their own thread. (Denied)

## Test Runner (Logic)
The `firestore.rules` will be verified against these vectors.
