# Firebase Security Specification - RequestFlow

## Data Invariants
1. **Requests**:
   - Must be authenticated to read or write.
   - Users can only read their own requests unless they are admins.
   - Only admins can update `qaStatus` or `archived` status (actually, in the app, users can update status but QA is restricted).
   - `id` must be a valid string.
   - `createdAt` is immutable.
2. **Users**:
   - Users can only read and write their own profile.
   - Admins can read all profiles.
   - `role` is immutable for regular users (cannot self-promote to admin).

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: User A tries to create a request for User B.
2. **Privilege Escalation**: Regular user tries to update their own profile to `role: 'admin'`.
3. **QA Injection**: Regular user tries to approve their own request by updating `qaStatus`.
4. **Orphaned Write**: Creating a request with a non-existent division.
5. **Junk ID**: Creating a request with a 2KB string as ID.
6. **Shadow Fields**: Adding `isVerified: true` to a request.
7. **Bypassing Immutability**: Updating `createdAt` timestamp.
8. **Resource Exhaustion**: Sending a 1MB string in `description`.
9. **Unauthorized Delete**: Regular user tries to delete an admin's request.
10. **State Shortcut**: Moving a request from 'Not Started' to 'Live' without 'In Progress'.
11. **PII Leak**: Authenticated user B tries to 'get' User A's email.
12. **Query Scraping**: Authenticated user tries to list all requests without a userId filter.

## Test Runner (firestore.rules.test.ts)

```typescript
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "ecom-ai-automations",
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
  });
});

test("regular user cannot change their own role", async () => {
  const alice = testEnv.authenticatedContext("alice");
  await assertFails(updateDoc(doc(alice.firestore(), "users/alice"), { role: "admin" }));
});

test("regular user cannot approve their own request", async () => {
  const alice = testEnv.authenticatedContext("alice");
  await assertFails(updateDoc(doc(alice.firestore(), "requests/req1"), { qaStatus: "Approved" }));
});
```
