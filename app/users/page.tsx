"use client";

import { useEffect, useState } from "react";

import { UsersPage } from "@/components/users/UsersPage";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { initialUsers } from "@/lib/demo-data";
import type { User } from "@/types";

export default function UsersRoute() {
  const [users, setUsers] = useLocalStorage<User[]>("vtc-users", initialUsers);
  const [currentUser, setCurrentUser] = useState<User>(initialUsers[0]);

  useEffect(() => {
    const session = window.localStorage.getItem("vtc-demo-session");

    if (!session) return;

    try {
      setCurrentUser(JSON.parse(session) as User);
    } catch {
      window.localStorage.removeItem("vtc-demo-session");
    }
  }, []);

  return (
    <div className="p-5 md:p-8">
      <UsersPage
        users={users}
        currentUser={currentUser}
        onChange={setUsers}
      />
    </div>
  );
}
