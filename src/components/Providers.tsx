"use client";
import { SessionProvider } from "next-auth/react";
import { DialogProvider } from "@/components/ui/Dialog";
import SignupPrompt from "@/components/SignupPrompt";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DialogProvider>
        {children}
        <SignupPrompt />
      </DialogProvider>
    </SessionProvider>
  );
}
