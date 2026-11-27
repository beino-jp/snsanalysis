import Dashboard from "@/components/dashboard";
import { internalEmail, requireAuth } from "@/server/auth";
import { redirect } from "next/navigation";
export const dynamic="force-dynamic";
export default async function Page() {
  let email:string;
  try{email=await requireAuth();}catch{redirect('/login');}
  if(!internalEmail(email))redirect('/analyze');
  return <Dashboard />;
}
