import { Navbar } from "@/components/sections/Navbar";
import { getAuthUser } from "@/lib/supabase/get-user";

export async function NavbarWithAuth() {
  const user = await getAuthUser();
  return <Navbar user={user} />;
}
